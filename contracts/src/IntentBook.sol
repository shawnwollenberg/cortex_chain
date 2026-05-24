// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Intent, Fill, IntentStatus, SolverBid, IntentTypehashes} from "./libraries/IntentTypes.sol";
import {IIntentBook} from "./interfaces/IIntentBook.sol";
import {IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";

contract IntentBook is IIntentBook, EIP712 {
    uint256 private _nextIntentId = 1;
    IAttestationRegistry public immutable attestationRegistry;

    mapping(uint256 => Intent) private _intents;
    mapping(uint256 => IntentStatus) private _statuses;
    mapping(address => mapping(uint256 => bool)) private _usedNonces;
    mapping(uint256 => mapping(uint256 => SolverBid)) private _bids;
    mapping(uint256 => uint256) private _nextBidId;
    mapping(uint256 => uint256) private _selectedBidId;

    constructor(address attestationRegistry_) EIP712("AgentIntentBook", "1") {
        attestationRegistry = IAttestationRegistry(attestationRegistry_);
    }

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

    function submitBid(
        uint256 intentId,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 validUntil,
        bytes32 executionHash
    ) external returns (uint256 bidId) {
        if (_statuses[intentId] != IntentStatus.OPEN) revert IntentNotOpen();

        Intent storage intent = _intents[intentId];
        if (intent.owner == address(0)) revert IntentNotOpen();
        if (block.timestamp >= intent.constraints.deadline) revert IntentExpired();
        if (validUntil <= block.timestamp || validUntil > intent.constraints.deadline) revert InvalidBid();
        if (amountIn > intent.constraints.amountInMax || amountOut < intent.constraints.amountOutMin) {
            revert ConstraintViolation();
        }

        bidId = ++_nextBidId[intentId];
        _bids[intentId][bidId] = SolverBid({
            solver: msg.sender,
            amountIn: amountIn,
            amountOut: amountOut,
            fee: fee,
            validUntil: validUntil,
            executionHash: executionHash,
            selected: false,
            exists: true
        });

        emit SolverBidSubmitted(intentId, bidId, msg.sender, amountIn, amountOut, fee, validUntil, executionHash);
    }

    function selectBid(uint256 intentId, uint256 bidId) external {
        if (_statuses[intentId] != IntentStatus.OPEN) revert IntentNotOpen();

        Intent storage intent = _intents[intentId];
        if (intent.owner != msg.sender) revert Unauthorized();

        SolverBid storage bid = _bids[intentId][bidId];
        if (!bid.exists) revert BidNotFound();
        if (block.timestamp > bid.validUntil) revert BidExpired();

        uint256 previousBidId = _selectedBidId[intentId];
        if (previousBidId != 0) {
            _bids[intentId][previousBidId].selected = false;
        }
        bid.selected = true;
        _selectedBidId[intentId] = bidId;

        emit SolverBidSelected(intentId, bidId, bid.solver);
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

        uint256 selectedBidId = _selectedBidId[intentId];
        if (selectedBidId == 0) revert SelectedBidRequired();

        SolverBid storage bid = _bids[intentId][selectedBidId];
        if (!bid.selected) revert BidNotSelected();
        if (block.timestamp > bid.validUntil) revert BidExpired();
        if (fill.solver != bid.solver || msg.sender != bid.solver) revert Unauthorized();
        if (fill.amountIn != bid.amountIn || fill.amountOut != bid.amountOut) revert ConstraintViolation();
        if (intent.execution.dataHash != bytes32(0) && bid.executionHash != intent.execution.dataHash) {
            revert ExecutionCommitmentMismatch();
        }
        _validateRequiredAttestation(intent, fill.attestationId);

        _statuses[intentId] = IntentStatus.FILLED;
        emit IntentFilled(intentId, fill.solver, fill.amountIn, fill.amountOut);
        emit IntentFillProof(intentId, fill.resultHash, fill.traceHash, fill.attestationId);
    }

    function _validateRequiredAttestation(Intent storage intent, uint256 attestationId) internal view {
        bytes32 requiredSubject = intent.execution.requiredAttestationSubject;
        bytes32 requiredSchema = intent.execution.requiredAttestationSchema;
        if (requiredSubject == bytes32(0) && requiredSchema == bytes32(0)) return;
        if (attestationId == 0) revert RequiredAttestationMissing();

        try attestationRegistry.getAttestation(attestationId) returns (IAttestationRegistry.Attestation memory attestation) {
            if (attestation.revoked) revert RequiredAttestationMissing();
            if (requiredSubject != bytes32(0) && attestation.subject != requiredSubject) {
                revert RequiredAttestationMissing();
            }
            if (requiredSchema != bytes32(0) && attestation.schema != requiredSchema) {
                revert RequiredAttestationMissing();
            }
        } catch {
            revert RequiredAttestationMissing();
        }
    }

    function getIntent(uint256 intentId) external view returns (Intent memory) {
        return _intents[intentId];
    }

    function getIntentStatus(uint256 intentId) external view returns (IntentStatus) {
        return _statuses[intentId];
    }

    function getBid(uint256 intentId, uint256 bidId) external view returns (SolverBid memory) {
        SolverBid memory bid = _bids[intentId][bidId];
        if (!bid.exists) revert BidNotFound();
        return bid;
    }

    function getSelectedBid(uint256 intentId) external view returns (uint256) {
        return _selectedBidId[intentId];
    }
}
