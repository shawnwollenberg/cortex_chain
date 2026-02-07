// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentBook} from "../src/IntentBook.sol";
import {IIntentBook} from "../src/interfaces/IIntentBook.sol";
import {Intent, Fill, IntentStatus, IntentType, Constraints, IntentTypehashes} from "../src/libraries/IntentTypes.sol";

contract IntentBookFuzzTest is Test {
    IntentBook public book;

    uint256 internal ownerPk;
    address internal owner;
    address internal solver = makeAddr("solver");
    address internal tokenIn = makeAddr("tokenIn");
    address internal tokenOut = makeAddr("tokenOut");

    bytes32 private constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        book = new IntentBook();
        (owner, ownerPk) = makeAddrAndKey("owner");
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

    // ── Constraint boundary fuzzing ──────────────────────────────────

    function testFuzz_submitIntent_validConstraints(
        uint256 amountInMax,
        uint256 amountOutMin,
        uint256 deadlineOffset,
        uint16 slippageBps,
        uint256 nonce
    ) public {
        amountInMax = bound(amountInMax, 1, type(uint256).max);
        amountOutMin = bound(amountOutMin, 0, amountInMax);
        deadlineOffset = bound(deadlineOffset, 1, 365 days);
        slippageBps = uint16(bound(slippageBps, 0, 10_000));

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: amountInMax,
                amountOutMin: amountOutMin,
                deadline: block.timestamp + deadlineOffset,
                slippageBps: slippageBps
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: nonce
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        uint256 intentId = book.submitIntent(intent, v, r, s);

        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.OPEN));
        Intent memory stored = book.getIntent(intentId);
        assertEq(stored.constraints.amountInMax, amountInMax);
        assertEq(stored.constraints.amountOutMin, amountOutMin);
        assertEq(stored.constraints.slippageBps, slippageBps);
    }

    function testFuzz_submitIntent_revertInvalidSlippage(uint16 slippageBps) public {
        slippageBps = uint16(bound(slippageBps, 10_001, type(uint16).max));

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18,
                amountOutMin: 900e18,
                deadline: block.timestamp + 1 hours,
                slippageBps: slippageBps
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        vm.expectRevert(IIntentBook.InvalidSlippage.selector);
        book.submitIntent(intent, v, r, s);
    }

    function testFuzz_submitIntent_revertPastDeadline(uint256 deadlineOffset) public {
        deadlineOffset = bound(deadlineOffset, 0, block.timestamp);

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18,
                amountOutMin: 900e18,
                deadline: deadlineOffset, // at or before current timestamp
                slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        vm.expectRevert(IIntentBook.InvalidDeadline.selector);
        book.submitIntent(intent, v, r, s);
    }

    // ── Fill constraint fuzzing ──────────────────────────────────────

    function testFuzz_fillIntent_validAmounts(uint256 amountIn, uint256 amountOut) public {
        uint256 maxIn = 1000e18;
        uint256 minOut = 500e18;
        amountIn = bound(amountIn, 0, maxIn);
        amountOut = bound(amountOut, minOut, type(uint256).max);

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: maxIn, amountOutMin: minOut, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        uint256 intentId = book.submitIntent(intent, v, r, s);

        Fill memory fill = Fill({amountIn: amountIn, amountOut: amountOut, solver: solver, executionData: ""});
        book.fillIntent(intentId, fill);
        assertEq(uint8(book.getIntentStatus(intentId)), uint8(IntentStatus.FILLED));
    }

    function testFuzz_fillIntent_revertAmountInExceeded(uint256 amountIn) public {
        uint256 maxIn = 1000e18;
        amountIn = bound(amountIn, maxIn + 1, type(uint256).max);

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: maxIn, amountOutMin: 500e18, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        uint256 intentId = book.submitIntent(intent, v, r, s);

        Fill memory fill = Fill({amountIn: amountIn, amountOut: 500e18, solver: solver, executionData: ""});
        vm.expectRevert(IIntentBook.ConstraintViolation.selector);
        book.fillIntent(intentId, fill);
    }

    function testFuzz_fillIntent_revertAmountOutTooLow(uint256 amountOut) public {
        uint256 minOut = 500e18;
        amountOut = bound(amountOut, 0, minOut - 1);

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: minOut, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        uint256 intentId = book.submitIntent(intent, v, r, s);

        Fill memory fill = Fill({amountIn: 1000e18, amountOut: amountOut, solver: solver, executionData: ""});
        vm.expectRevert(IIntentBook.ConstraintViolation.selector);
        book.fillIntent(intentId, fill);
    }

    // ── Signature fuzzing ────────────────────────────────────────────

    function testFuzz_submitIntent_revertWrongSigner(uint256 wrongPkSeed) public {
        // Ensure the wrong key is different from the owner's
        wrongPkSeed = bound(wrongPkSeed, 1, type(uint256).max - 1);
        (address wrongAddr, uint256 wrongPk) = makeAddrAndKey(string(abi.encodePacked("wrong", wrongPkSeed)));
        vm.assume(wrongAddr != owner);

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 900e18, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, wrongPk);
        vm.expectRevert(IIntentBook.InvalidSignature.selector);
        book.submitIntent(intent, v, r, s);
    }

    // ── Nonce replay fuzzing ─────────────────────────────────────────

    function testFuzz_submitIntent_nonceReplayReverts(uint256 nonce) public {
        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 900e18, deadline: block.timestamp + 1 hours, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: nonce
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        book.submitIntent(intent, v, r, s);

        // Same nonce, same intent — must revert
        (v, r, s) = _signIntent(intent, ownerPk);
        vm.expectRevert(IIntentBook.InvalidNonce.selector);
        book.submitIntent(intent, v, r, s);
    }

    // ── Deadline expiration fuzzing ──────────────────────────────────

    function testFuzz_fillIntent_revertAfterDeadline(uint256 deadlineOffset, uint256 warpPast) public {
        deadlineOffset = bound(deadlineOffset, 1, 365 days);
        warpPast = bound(warpPast, 0, 365 days);

        uint256 deadline = block.timestamp + deadlineOffset;

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 900e18, deadline: deadline, slippageBps: 100
            }),
            inputToken: tokenIn,
            outputToken: tokenOut,
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = _signIntent(intent, ownerPk);
        uint256 intentId = book.submitIntent(intent, v, r, s);

        // Warp past the deadline
        vm.warp(deadline + warpPast);

        Fill memory fill = Fill({amountIn: 950e18, amountOut: 900e18, solver: solver, executionData: ""});
        vm.expectRevert(IIntentBook.IntentExpired.selector);
        book.fillIntent(intentId, fill);
    }
}
