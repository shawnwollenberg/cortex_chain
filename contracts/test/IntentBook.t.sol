// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentBook} from "../src/IntentBook.sol";
import {IIntentBook} from "../src/interfaces/IIntentBook.sol";
import {Intent, Fill, IntentStatus, IntentType, Constraints, IntentTypehashes} from "../src/libraries/IntentTypes.sol";

contract IntentBookTest is Test {
    IntentBook public book;

    uint256 internal ownerPk;
    address internal owner;
    address internal solver = makeAddr("solver");
    address internal tokenIn = makeAddr("tokenIn");
    address internal tokenOut = makeAddr("tokenOut");

    // EIP-712 domain values matching the constructor
    bytes32 private constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        book = new IntentBook();
        (owner, ownerPk) = makeAddrAndKey("owner");
    }

    // ── Helpers ─────────────────────────────────────────────────────

    function _defaultIntent(uint256 nonce) internal view returns (Intent memory) {
        return Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 900e18, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: nonce
        });
    }

    function _signIntent(Intent memory intent, uint256 pk) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                TYPE_HASH, keccak256(bytes("AgentIntentBook")), keccak256(bytes("1")), block.chainid, address(book)
            )
        );
        bytes32 structHash = IntentTypehashes.hashIntent(intent);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function _submitDefault(uint256 nonce) internal returns (uint256) {
        Intent memory intent = _defaultIntent(nonce);
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        return book.submitIntent(intent, v, r, s);
    }

    // ── Submit ──────────────────────────────────────────────────────

    function test_submitIntent() public {
        uint256 intentId = _submitDefault(1);
        assertEq(intentId, 1);
        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.OPEN));

        Intent memory stored = book.getIntent(intentId);
        assertEq(stored.owner, owner);
        assertEq(stored.nonce, 1);
    }

    function test_submitIntent_emitsEvent() public {
        Intent memory intent = _defaultIntent(42);
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);

        vm.expectEmit(true, true, false, true);
        emit IIntentBook.IntentSubmitted(1, owner, 42);
        book.submitIntent(intent, v, r, s);
    }

    function test_submitIntent_revertInvalidSignature() public {
        Intent memory intent = _defaultIntent(1);
        (, uint256 wrongPk) = makeAddrAndKey("wrong");
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, wrongPk);

        vm.expectRevert(IIntentBook.InvalidSignature.selector);
        book.submitIntent(intent, v, r, s);
    }

    function test_submitIntent_revertReplayedNonce() public {
        _submitDefault(1);

        Intent memory intent = _defaultIntent(1);
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);

        vm.expectRevert(IIntentBook.InvalidNonce.selector);
        book.submitIntent(intent, v, r, s);
    }

    function test_submitIntent_revertPastDeadline() public {
        Intent memory intent = _defaultIntent(1);
        intent.constraints.deadline = block.timestamp; // not in future
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);

        vm.expectRevert(IIntentBook.InvalidDeadline.selector);
        book.submitIntent(intent, v, r, s);
    }

    function test_submitIntent_revertInvalidSlippage() public {
        Intent memory intent = _defaultIntent(1);
        intent.constraints.slippageBps = 10_001;
        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);

        vm.expectRevert(IIntentBook.InvalidSlippage.selector);
        book.submitIntent(intent, v, r, s);
    }

    function test_submitIntent_multipleNonces() public {
        uint256 id1 = _submitDefault(1);
        uint256 id2 = _submitDefault(2);
        uint256 id3 = _submitDefault(100);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    // ── Cancel ──────────────────────────────────────────────────────

    function test_cancelIntent() public {
        uint256 intentId = _submitDefault(1);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit IIntentBook.IntentCancelled(intentId);
        book.cancelIntent(intentId);

        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.CANCELLED));
    }

    function test_cancelIntent_revertNotOwner() public {
        uint256 intentId = _submitDefault(1);

        vm.prank(solver);
        vm.expectRevert(IIntentBook.Unauthorized.selector);
        book.cancelIntent(intentId);
    }

    function test_cancelIntent_revertNotOpen() public {
        uint256 intentId = _submitDefault(1);

        vm.prank(owner);
        book.cancelIntent(intentId);

        vm.prank(owner);
        vm.expectRevert(IIntentBook.IntentNotOpen.selector);
        book.cancelIntent(intentId);
    }

    // ── Fill ────────────────────────────────────────────────────────

    function test_fillIntent() public {
        uint256 intentId = _submitDefault(1);

        Fill memory fill = Fill({amountIn: 950e18, amountOut: 900e18, solver: solver, executionData: ""});

        vm.expectEmit(true, true, false, true);
        emit IIntentBook.IntentFilled(intentId, solver, 950e18, 900e18);
        book.fillIntent(intentId, fill);

        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.FILLED));
    }

    function test_fillIntent_revertAmountInExceeded() public {
        uint256 intentId = _submitDefault(1);

        Fill memory fill = Fill({amountIn: 1001e18, amountOut: 900e18, solver: solver, executionData: ""});

        vm.expectRevert(IIntentBook.ConstraintViolation.selector);
        book.fillIntent(intentId, fill);
    }

    function test_fillIntent_revertAmountOutTooLow() public {
        uint256 intentId = _submitDefault(1);

        Fill memory fill = Fill({amountIn: 1000e18, amountOut: 899e18, solver: solver, executionData: ""});

        vm.expectRevert(IIntentBook.ConstraintViolation.selector);
        book.fillIntent(intentId, fill);
    }

    function test_fillIntent_revertExpired() public {
        uint256 intentId = _submitDefault(1);

        vm.warp(block.timestamp + 2 hours);

        Fill memory fill = Fill({amountIn: 950e18, amountOut: 900e18, solver: solver, executionData: ""});

        vm.expectRevert(IIntentBook.IntentExpired.selector);
        book.fillIntent(intentId, fill);

        // Revert rolled back the EXPIRED state change, status remains OPEN in storage.
        // The intent is functionally expired — any fill attempt will keep reverting.
        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.OPEN));
    }

    function test_fillIntent_revertAlreadyFilled() public {
        uint256 intentId = _submitDefault(1);

        Fill memory fill = Fill({amountIn: 950e18, amountOut: 900e18, solver: solver, executionData: ""});
        book.fillIntent(intentId, fill);

        vm.expectRevert(IIntentBook.IntentNotOpen.selector);
        book.fillIntent(intentId, fill);
    }

    function test_fillIntent_revertCancelled() public {
        uint256 intentId = _submitDefault(1);

        vm.prank(owner);
        book.cancelIntent(intentId);

        Fill memory fill = Fill({amountIn: 950e18, amountOut: 900e18, solver: solver, executionData: ""});
        vm.expectRevert(IIntentBook.IntentNotOpen.selector);
        book.fillIntent(intentId, fill);
    }

    // ── Boundary fills ──────────────────────────────────────────────

    function test_fillIntent_exactBoundary() public {
        uint256 intentId = _submitDefault(1);

        // Exactly at max in and min out — should succeed
        Fill memory fill = Fill({amountIn: 1000e18, amountOut: 900e18, solver: solver, executionData: ""});
        book.fillIntent(intentId, fill);
        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.FILLED));
    }
}
