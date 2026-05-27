// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal adapter interface for executing quote-bound Cortex settlement plans.
/// @dev The adapter does not parse JSON. Agents and merchants verify the canonical
/// settlement plan offchain, then pass the plan hash and deterministic line data here.
interface ISettlementAdapter {
    enum LineKind {
        MERCHANT,
        SUPPLIER,
        TAX,
        TIP,
        SHIPPING,
        HANDLING,
        PLATFORM_FEE,
        FACILITATOR_FEE,
        PROTOCOL_FEE,
        ESCROW
    }

    struct SettlementLine {
        LineKind kind;
        address recipient;
        address token;
        uint256 amount;
        bytes32 metadataHash;
    }

    struct SettlementInstruction {
        bytes32 quoteHash;
        bytes32 settlementPlanHash;
        address payer;
        address token;
        uint256 grossAmount;
        uint256 deadline;
        SettlementLine[] lines;
    }

    event SettlementExecuted(
        bytes32 indexed quoteHash,
        bytes32 indexed settlementPlanHash,
        address indexed payer,
        address token,
        uint256 grossAmount,
        bytes32 executionHash
    );

    function executeSettlement(SettlementInstruction calldata instruction) external payable returns (bytes32 executionHash);
}
