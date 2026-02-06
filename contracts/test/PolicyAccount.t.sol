// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyAccount} from "../src/PolicyAccount.sol";
import {PolicyModule} from "../src/PolicyModule.sol";
import {IPolicyModule} from "../src/interfaces/IPolicyModule.sol";
import {Account as OZAccount} from "@openzeppelin/contracts/account/Account.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import {ERC4337Utils} from "@openzeppelin/contracts/account/utils/draft-ERC4337Utils.sol";

/// @dev Dummy target that accepts ETH and has a callable function
contract MockTarget {
    uint256 public value;

    function setValue(uint256 v) external {
        value = v;
    }

    receive() external payable {}
}

contract PolicyAccountTest is Test {
    PolicyModule public module;
    PolicyAccount public acct;
    MockTarget public target;

    address public entryPoint = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    address public signer;
    uint256 public signerKey;

    function setUp() public {
        (signer, signerKey) = makeAddrAndKey("signer");

        module = new PolicyModule();
        acct = new PolicyAccount(signer, IPolicyModule(address(module)));
        target = new MockTarget();

        // Fund the account
        vm.deal(address(acct), 10 ether);

        // Configure policies via entryPoint (simulating UserOp execution)
        vm.startPrank(entryPoint);
        acct.setTargetAllowed(address(target), true);
        acct.setSpendLimit(address(0), 2 ether);
        vm.stopPrank();
    }

    // ── Execute with policies ────────────────────────────────────────

    function test_execute_callWithinPolicy() public {
        bytes memory data = abi.encodeCall(MockTarget.setValue, (42));

        vm.prank(entryPoint);
        acct.execute(address(target), 0, data);

        assertEq(target.value(), 42);
    }

    function test_execute_sendEthWithinLimit() public {
        vm.prank(entryPoint);
        acct.execute(address(target), 1 ether, "");

        assertEq(address(target).balance, 1 ether);
        assertEq(module.getSpentToday(address(acct), address(0)), 1 ether);
    }

    function test_execute_sendEthExactLimit() public {
        vm.prank(entryPoint);
        acct.execute(address(target), 2 ether, "");

        assertEq(module.getSpentToday(address(acct), address(0)), 2 ether);
    }

    // ── Execute blocked by target ────────────────────────────────────

    function test_execute_blockedByTarget() public {
        address disallowed = makeAddr("disallowed");

        vm.prank(entryPoint);
        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.TargetNotAllowed.selector, disallowed));
        acct.execute(disallowed, 0, "");
    }

    // ── Execute blocked by spend limit ───────────────────────────────

    function test_execute_blockedBySpendLimit() public {
        vm.prank(entryPoint);
        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), 3 ether, 2 ether)
        );
        acct.execute(address(target), 3 ether, "");
    }

    function test_execute_blockedBySpendLimit_cumulative() public {
        vm.startPrank(entryPoint);
        acct.execute(address(target), 1.5 ether, "");

        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), 1 ether, 0.5 ether)
        );
        acct.execute(address(target), 1 ether, "");
        vm.stopPrank();
    }

    // ── Execute blocked by function allowlist ────────────────────────

    function test_execute_blockedByFunctionAllowlist() public {
        bytes4 setValueSel = MockTarget.setValue.selector;
        bytes4 otherSel = bytes4(keccak256("otherFunction()"));

        vm.startPrank(entryPoint);
        acct.setUseFunctionAllowlist(true);
        acct.setFunctionAllowed(address(target), setValueSel, true);
        vm.stopPrank();

        // Allowed function works
        vm.prank(entryPoint);
        acct.execute(address(target), 0, abi.encodeCall(MockTarget.setValue, (99)));
        assertEq(target.value(), 99);

        // Disallowed function reverts
        vm.prank(entryPoint);
        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.FunctionNotAllowed.selector, address(target), otherSel));
        acct.execute(address(target), 0, abi.encodeWithSelector(otherSel));
    }

    // ── Policy updates via execute ───────────────────────────────────

    function test_policyUpdate_viaEntryPoint() public {
        address newTarget = makeAddr("newTarget");
        assertFalse(module.isTargetAllowed(address(acct), newTarget));

        vm.prank(entryPoint);
        acct.setTargetAllowed(newTarget, true);

        assertTrue(module.isTargetAllowed(address(acct), newTarget));
    }

    function test_policyUpdate_revertIfNotEntryPointOrSelf() public {
        address random = makeAddr("random");

        vm.prank(random);
        vm.expectRevert(abi.encodeWithSelector(OZAccount.AccountUnauthorized.selector, random));
        acct.setTargetAllowed(address(target), true);
    }

    // ── onlyEntryPointOrSelf ─────────────────────────────────────────

    function test_execute_revertIfNotEntryPointOrSelf() public {
        address random = makeAddr("random");

        vm.prank(random);
        vm.expectRevert(abi.encodeWithSelector(OZAccount.AccountUnauthorized.selector, random));
        acct.execute(address(target), 0, "");
    }

    // ── Receive ETH ──────────────────────────────────────────────────

    function test_receiveEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(acct).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(acct).balance, 11 ether);
    }

    // ── Signature validation ─────────────────────────────────────────

    function test_signer() public view {
        assertEq(acct.signer(), signer);
    }

    function test_validateUserOp_validSignature() public {
        PackedUserOperation memory userOp = _buildUserOp();
        bytes32 userOpHash = keccak256("test_op");

        // Sign the hash
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(entryPoint);
        uint256 validationData = acct.validateUserOp(userOp, userOpHash, 0);
        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_SUCCESS);
    }

    function test_validateUserOp_invalidSignature() public {
        PackedUserOperation memory userOp = _buildUserOp();
        bytes32 userOpHash = keccak256("test_op");

        // Sign with wrong key
        (, uint256 wrongKey) = makeAddrAndKey("wrong");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, userOpHash);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(entryPoint);
        uint256 validationData = acct.validateUserOp(userOp, userOpHash, 0);
        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_FAILED);
    }

    function test_validateUserOp_revertIfNotEntryPoint() public {
        PackedUserOperation memory userOp = _buildUserOp();
        bytes32 userOpHash = keccak256("test_op");

        vm.prank(makeAddr("random"));
        vm.expectRevert(abi.encodeWithSelector(OZAccount.AccountUnauthorized.selector, makeAddr("random")));
        acct.validateUserOp(userOp, userOpHash, 0);
    }

    // ── Spend limit resets after 24h via execute ─────────────────────

    function test_execute_spendLimitResetsAfter24h() public {
        vm.prank(entryPoint);
        acct.execute(address(target), 2 ether, "");

        // At limit now
        vm.prank(entryPoint);
        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), 0.1 ether, 0)
        );
        acct.execute(address(target), 0.1 ether, "");

        // Warp 24h
        vm.warp(block.timestamp + 1 days);

        // Should be able to spend again
        vm.prank(entryPoint);
        acct.execute(address(target), 1 ether, "");
        assertEq(module.getSpentToday(address(acct), address(0)), 1 ether);
    }

    // ── Execution failure propagation ────────────────────────────────

    function test_execute_propagatesRevert() public {
        // Call a function that doesn't exist on target — will succeed because fallback/no revert
        // Let's test with a contract that reverts instead
        RevertingTarget rt = new RevertingTarget();

        vm.startPrank(entryPoint);
        acct.setTargetAllowed(address(rt), true);

        vm.expectRevert(
            abi.encodeWithSelector(
                PolicyAccount.ExecutionFailed.selector, abi.encodeWithSignature("Error(string)", "boom")
            )
        );
        acct.execute(address(rt), 0, abi.encodeCall(RevertingTarget.fail, ()));
        vm.stopPrank();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _buildUserOp() internal view returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: address(acct),
            nonce: 0,
            initCode: "",
            callData: "",
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }
}

contract RevertingTarget {
    function fail() external pure {
        revert("boom");
    }
}
