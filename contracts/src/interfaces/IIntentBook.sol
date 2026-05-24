// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Intent, Fill, IntentStatus, SolverBid} from "../libraries/IntentTypes.sol";

interface IIntentBook {
    event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce);
    event IntentCancelled(uint256 indexed intentId);
    event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut);
    event IntentFillProof(
        uint256 indexed intentId,
        bytes32 resultHash,
        bytes32 traceHash,
        uint256 indexed attestationId
    );
    event SolverBidSubmitted(
        uint256 indexed intentId,
        uint256 indexed bidId,
        address indexed solver,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 validUntil,
        bytes32 executionHash
    );
    event SolverBidSelected(uint256 indexed intentId, uint256 indexed bidId, address indexed solver);

    error Unauthorized();
    error InvalidNonce();
    error IntentExpired();
    error IntentNotOpen();
    error ConstraintViolation();
    error InvalidSlippage();
    error InvalidDeadline();
    error InvalidSignature();
    error InvalidBid();
    error BidNotFound();
    error BidExpired();
    error BidNotSelected();
    error SelectedBidRequired();
    error ExecutionCommitmentMismatch();
    error RequiredAttestationMissing();

    function submitIntent(Intent calldata intent, uint8 v, bytes32 r, bytes32 s) external returns (uint256 intentId);

    function cancelIntent(uint256 intentId) external;

    function fillIntent(uint256 intentId, Fill calldata fill) external;

    function submitBid(
        uint256 intentId,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 validUntil,
        bytes32 executionHash
    ) external returns (uint256 bidId);

    function selectBid(uint256 intentId, uint256 bidId) external;

    function getIntent(uint256 intentId) external view returns (Intent memory);

    function getIntentStatus(uint256 intentId) external view returns (IntentStatus);

    function getBid(uint256 intentId, uint256 bidId) external view returns (SolverBid memory);

    function getSelectedBid(uint256 intentId) external view returns (uint256);
}
