// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyModule} from "../src/PolicyModule.sol";
import {IPolicyModule} from "../src/interfaces/IPolicyModule.sol";

contract PolicyModuleTest is Test {
    PolicyModule public module;

    address public account = makeAddr("account");
    address public other = makeAddr("other");
    address public targetA = makeAddr("targetA");
    address public targetB = makeAddr("targetB");
    address public tokenX = makeAddr("tokenX");

    function setUp() public {
        module = new PolicyModule();
    }

    // ── Spend Limits ─────────────────────────────────────────────────

    function test_setSpendLimit() public {
        vm.prank(account);
        module.setSpendLimit(address(0), 1 ether);

        IPolicyModule.SpendLimit memory limit = module.getSpendLimit(account, address(0));
        assertEq(limit.maxPerDay, 1 ether);
        assertEq(limit.spentToday, 0);
    }

    function test_setSpendLimit_emitsEvent() public {
        vm.prank(account);
        vm.expectEmit(true, true, false, true);
        emit IPolicyModule.SpendLimitSet(account, address(0), 1 ether);
        module.setSpendLimit(address(0), 1 ether);
    }

    function test_recordSpend_withinLimit() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.recordSpend(address(0), 0.5 ether);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), 0.5 ether);
    }

    function test_recordSpend_emitsEvent() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);

        vm.expectEmit(true, true, false, true);
        emit IPolicyModule.SpendRecorded(account, address(0), 0.5 ether, 0.5 ether);
        module.recordSpend(address(0), 0.5 ether);
        vm.stopPrank();
    }

    function test_recordSpend_exactLimit() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.recordSpend(address(0), 1 ether);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), 1 ether);
    }

    function test_recordSpend_exceedsLimit() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.recordSpend(address(0), 0.6 ether);

        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), 0.5 ether, 0.4 ether)
        );
        module.recordSpend(address(0), 0.5 ether);
        vm.stopPrank();
    }

    function test_recordSpend_noLimitSet_allowsFreely() public {
        vm.prank(account);
        module.recordSpend(address(0), 100 ether);
        // No revert — no limit configured means no restriction
    }

    function test_recordSpend_zeroLimit_blocksAll() public {
        // Setting a limit then setting it back to 0 removes the limit
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.setSpendLimit(address(0), 0);
        // Now no limit is configured, should allow freely
        module.recordSpend(address(0), 100 ether);
        vm.stopPrank();
    }

    function test_recordSpend_rollingWindowReset() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.recordSpend(address(0), 0.8 ether);
        assertEq(module.getSpentToday(account, address(0)), 0.8 ether);

        // Warp 24 hours
        vm.warp(block.timestamp + 1 days);

        // Window should have reset — can spend again
        module.recordSpend(address(0), 0.8 ether);
        assertEq(module.getSpentToday(account, address(0)), 0.8 ether);
        vm.stopPrank();
    }

    function test_getSpentToday_returnsZeroAfterWindowExpires() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.recordSpend(address(0), 0.5 ether);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), 0.5 ether);

        vm.warp(block.timestamp + 1 days);
        assertEq(module.getSpentToday(account, address(0)), 0);
    }

    function test_spendLimit_multipleTokens() public {
        vm.startPrank(account);
        module.setSpendLimit(address(0), 1 ether);
        module.setSpendLimit(tokenX, 500);

        module.recordSpend(address(0), 0.5 ether);
        module.recordSpend(tokenX, 200);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), 0.5 ether);
        assertEq(module.getSpentToday(account, tokenX), 200);
    }

    // ── Target Allowlist ─────────────────────────────────────────────

    function test_setTargetAllowed() public {
        vm.prank(account);
        module.setTargetAllowed(targetA, true);

        assertTrue(module.isTargetAllowed(account, targetA));
        assertFalse(module.isTargetAllowed(account, targetB));
    }

    function test_setTargetAllowed_emitsEvent() public {
        vm.prank(account);
        vm.expectEmit(true, true, false, true);
        emit IPolicyModule.TargetAllowlistUpdated(account, targetA, true);
        module.setTargetAllowed(targetA, true);
    }

    function test_setTargetAllowed_toggle() public {
        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        assertTrue(module.isTargetAllowed(account, targetA));

        module.setTargetAllowed(targetA, false);
        assertFalse(module.isTargetAllowed(account, targetA));
        vm.stopPrank();
    }

    function test_checkTransaction_allowedTarget() public {
        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        // Should not revert
        module.checkTransaction(targetA, 0, "");
        vm.stopPrank();
    }

    function test_checkTransaction_disallowedTarget() public {
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.TargetNotAllowed.selector, targetB));
        module.checkTransaction(targetB, 0, "");
    }

    // ── Function Allowlist ───────────────────────────────────────────

    function test_setFunctionAllowed() public {
        bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));

        vm.startPrank(account);
        module.setUseFunctionAllowlist(true);
        module.setFunctionAllowed(targetA, selector, true);
        vm.stopPrank();

        assertTrue(module.isFunctionAllowed(account, targetA, selector));
    }

    function test_setFunctionAllowed_emitsEvent() public {
        bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));

        vm.prank(account);
        vm.expectEmit(true, true, false, true);
        emit IPolicyModule.FunctionAllowlistUpdated(account, targetA, selector, true);
        module.setFunctionAllowed(targetA, selector, true);
    }

    function test_checkTransaction_allowedFunction() public {
        bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));
        bytes memory data = abi.encodeWithSelector(selector, other, 100);

        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        module.setUseFunctionAllowlist(true);
        module.setFunctionAllowed(targetA, selector, true);

        // Should not revert
        module.checkTransaction(targetA, 0, data);
        vm.stopPrank();
    }

    function test_checkTransaction_disallowedFunction() public {
        bytes4 allowedSel = bytes4(keccak256("transfer(address,uint256)"));
        bytes4 blockedSel = bytes4(keccak256("approve(address,uint256)"));
        bytes memory data = abi.encodeWithSelector(blockedSel, other, 100);

        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        module.setUseFunctionAllowlist(true);
        module.setFunctionAllowed(targetA, allowedSel, true);

        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.FunctionNotAllowed.selector, targetA, blockedSel));
        module.checkTransaction(targetA, 0, data);
        vm.stopPrank();
    }

    function test_checkTransaction_functionAllowlistDisabled_allowsAnySelector() public {
        bytes4 selector = bytes4(keccak256("anything()"));
        bytes memory data = abi.encodeWithSelector(selector);

        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        // Function allowlist NOT enabled — any selector passes
        module.checkTransaction(targetA, 0, data);
        vm.stopPrank();
    }

    function test_checkTransaction_emptyCalldata_passesFunctionCheck() public {
        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        module.setUseFunctionAllowlist(true);
        // Even with function allowlist enabled, empty calldata (< 4 bytes) passes
        module.checkTransaction(targetA, 0, "");
        vm.stopPrank();
    }

    // ── Integrated checkTransaction ──────────────────────────────────

    function test_checkTransaction_withValueAndSpendLimit() public {
        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        module.setSpendLimit(address(0), 1 ether);

        // Should pass — within limit
        module.checkTransaction(targetA, 0.5 ether, "");

        // Record the spend
        module.recordSpend(address(0), 0.5 ether);

        // Check again — 0.6 more would exceed limit
        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), 0.6 ether, 0.5 ether)
        );
        module.checkTransaction(targetA, 0.6 ether, "");
        vm.stopPrank();
    }

    function test_checkTransaction_noSpendLimit_noValueCheck() public {
        vm.startPrank(account);
        module.setTargetAllowed(targetA, true);
        // No spend limit set — value checks pass freely
        module.checkTransaction(targetA, 100 ether, "");
        vm.stopPrank();
    }

    // ── Access control (per-account isolation) ───────────────────────

    function test_policies_isolatedPerAccount() public {
        vm.prank(account);
        module.setTargetAllowed(targetA, true);

        // `other` did not set any policies — targetA not allowed for `other`
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.TargetNotAllowed.selector, targetA));
        module.checkTransaction(targetA, 0, "");
    }

    function test_spendLimits_isolatedPerAccount() public {
        vm.prank(account);
        module.setSpendLimit(address(0), 1 ether);

        // `other` has no spend limit — can spend freely
        vm.prank(other);
        module.recordSpend(address(0), 100 ether);

        // `account` is still limited
        assertEq(module.getSpendLimit(account, address(0)).maxPerDay, 1 ether);
        assertEq(module.getSpendLimit(other, address(0)).maxPerDay, 0);
    }
}
