// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Intent, Fill, IntentStatus, IntentTypehashes} from "./libraries/IntentTypes.sol";
import {IIntentBook} from "./interfaces/IIntentBook.sol";

contract IntentBook is IIntentBook, EIP712 {
    uint256 private _nextIntentId = 1;

    mapping(uint256 => Intent) private _intents;
    mapping(uint256 => IntentStatus) private _statuses;
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    constructor() EIP712("AgentIntentBook", "1") {}

    function submitIntent(Intent calldata intent, uint8 v, bytes32 r, bytes32 s) external returns (uint256 intentId) {
        if (intent.constraints.deadline <= block.timestamp) revert InvalidDeadline();
        if (intent.constraints.slippageBps > 10_000) revert InvalidSlippage();
        if (_usedNonces[intent.owner][intent.nonce]) revert InvalidNonce();

        bytes32 structHash = IntentTypehashes.hashIntent(intent);
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != intent.owner) revert InvalidSignature();

        _usedNonces[intent.owner][intent.nonce] = true;

        intentId = _nextIntentId++;
        _intents[intentId] = intent;
        _statuses[intentId] = IntentStatus.OPEN;

        emit IntentSubmitted(intentId, intent.owner, intent.nonce);
    }

    function cancelIntent(uint256 intentId) external {
        if (_statuses[intentId] != IntentStatus.OPEN) revert IntentNotOpen();
        if (_intents[intentId].owner != msg.sender) revert Unauthorized();

        _statuses[intentId] = IntentStatus.CANCELLED;
        emit IntentCancelled(intentId);
    }

    function fillIntent(uint256 intentId, Fill calldata fill) external {
        if (_statuses[intentId] != IntentStatus.OPEN) revert IntentNotOpen();

        Intent storage intent = _intents[intentId];
        if (intent.owner == address(0)) revert IntentNotOpen();

        // Lazy expiration
        if (block.timestamp >= intent.constraints.deadline) {
            _statuses[intentId] = IntentStatus.EXPIRED;
            revert IntentExpired();
        }

        if (fill.amountIn > intent.constraints.amountInMax) revert ConstraintViolation();
        if (fill.amountOut < intent.constraints.amountOutMin) revert ConstraintViolation();

        _statuses[intentId] = IntentStatus.FILLED;
        emit IntentFilled(intentId, fill.solver, fill.amountIn, fill.amountOut);
    }

    function getIntent(uint256 intentId) external view returns (Intent memory) {
        return _intents[intentId];
    }

    function getIntentStatus(uint256 intentId) external view returns (IntentStatus) {
        return _statuses[intentId];
    }
}
