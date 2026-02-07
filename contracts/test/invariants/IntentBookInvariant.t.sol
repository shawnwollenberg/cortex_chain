// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentBook} from "../../src/IntentBook.sol";
import {IIntentBook} from "../../src/interfaces/IIntentBook.sol";
import {
    Intent,
    Fill,
    IntentStatus,
    IntentType,
    Constraints,
    IntentTypehashes
} from "../../src/libraries/IntentTypes.sol";

contract IntentBookHandler is Test {
    IntentBook public book;

    uint256 public ownerPk;
    address public owner;

    uint256 public submittedCount;
    uint256 public filledCount;
    uint256 public cancelledCount;

    // Track which intents have been filled to check no double-fill
    mapping(uint256 => bool) public wasFilled;
    // Track used nonces to ensure no reuse
    mapping(uint256 => bool) public usedNonces;
    // Track all nonces that were successfully used (for replay invariant)
    uint256[] public usedNonceList;

    function usedNonceCount() external view returns (uint256) {
        return usedNonceList.length;
    }

    bytes32 private constant DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    constructor(IntentBook _book) {
        book = _book;
        (owner, ownerPk) = makeAddrAndKey("handler-owner");
    }

    function submitIntent(uint256 nonceSeed) external {
        uint256 nonce = bound(nonceSeed, 0, 1_000_000);
        if (usedNonces[nonce]) return;

        Intent memory intent = Intent({
            owner: owner,
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 500e18, deadline: block.timestamp + 1 days, slippageBps: 100
            }),
            inputToken: address(1),
            outputToken: address(2),
            nonce: nonce
        });

        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPE_HASH,
                keccak256(bytes("AgentIntentBook")),
                keccak256(bytes("1")),
                block.chainid,
                address(book)
            )
        );
        bytes32 structHash = IntentTypehashes.hashIntent(intent);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);

        book.submitIntent(intent, v, r, s);
        usedNonces[nonce] = true;
        usedNonceList.push(nonce);
        submittedCount++;
    }

    function fillIntent(uint256 intentIdSeed) external {
        uint256 intentId = bound(intentIdSeed, 1, submittedCount == 0 ? 1 : submittedCount);
        if (book.getIntentStatus(intentId) != IntentStatus.OPEN) return;

        Fill memory fill = Fill({amountIn: 800e18, amountOut: 600e18, solver: address(this), executionData: ""});

        book.fillIntent(intentId, fill);
        wasFilled[intentId] = true;
        filledCount++;
    }

    function cancelIntent(uint256 intentIdSeed) external {
        uint256 intentId = bound(intentIdSeed, 1, submittedCount == 0 ? 1 : submittedCount);
        if (book.getIntentStatus(intentId) != IntentStatus.OPEN) return;

        vm.prank(owner);
        book.cancelIntent(intentId);
        cancelledCount++;
    }
}

contract IntentBookInvariantTest is Test {
    IntentBook public book;
    IntentBookHandler public handler;

    function setUp() public {
        book = new IntentBook();
        handler = new IntentBookHandler(book);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = IntentBookHandler.submitIntent.selector;
        selectors[1] = IntentBookHandler.fillIntent.selector;
        selectors[2] = IntentBookHandler.cancelIntent.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice No intent can be filled more than once.
    function invariant_noDoubleFill() public view {
        for (uint256 i = 1; i <= handler.submittedCount(); i++) {
            if (handler.wasFilled(i)) {
                assertEq(uint8(book.getIntentStatus(i)), uint8(IntentStatus.FILLED));
            }
        }
    }

    /// @notice Filled + cancelled count can never exceed submitted count.
    function invariant_statusConsistency() public view {
        assertLe(handler.filledCount() + handler.cancelledCount(), handler.submittedCount());
    }

    /// @notice Once a nonce is used, attempting to resubmit with that nonce must revert.
    function invariant_nonceReplayProtection() public {
        uint256 count = handler.usedNonceCount();
        if (count == 0) return;

        // Pick the most recent nonce and attempt to replay it
        uint256 usedNonce = handler.usedNonceList(count - 1);

        Intent memory intent = Intent({
            owner: handler.owner(),
            intentType: IntentType.SWAP_EXACT_IN_MAX_SLIPPAGE,
            constraints: Constraints({
                amountInMax: 1000e18, amountOutMin: 500e18, deadline: block.timestamp + 1 days, slippageBps: 100
            }),
            inputToken: address(1),
            outputToken: address(2),
            nonce: usedNonce
        });

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AgentIntentBook")),
                keccak256(bytes("1")),
                block.chainid,
                address(book)
            )
        );
        bytes32 structHash = IntentTypehashes.hashIntent(intent);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(handler.ownerPk(), digest);

        vm.expectRevert(IIntentBook.InvalidNonce.selector);
        book.submitIntent(intent, v, r, s);
    }
}
