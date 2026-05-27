// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementAdapter} from "./interfaces/ISettlementAdapter.sol";

/// @notice Executes deterministic Cortex settlement plans after offchain quote verification.
/// @dev The adapter intentionally does not parse JSON. Callers pass line data derived from
/// a canonical settlement plan whose hash is already bound into the Cortex quote terms.
contract SettlementAdapter is ISettlementAdapter {
    using SafeERC20 for IERC20;

    error EmptyQuoteHash();
    error EmptySettlementPlanHash();
    error DeadlineExpired();
    error PayerMismatch();
    error NoSettlementLines();
    error InvalidRecipient();
    error InvalidLineToken();
    error InvalidLineAmount();
    error InvalidNativeValue();
    error InvalidERC20Value();
    error LineTotalMismatch();
    error NativeTransferFailed();

    address public constant NATIVE_TOKEN = address(0);

    function executeSettlement(SettlementInstruction calldata instruction)
        external
        payable
        returns (bytes32 executionHash)
    {
        if (instruction.quoteHash == bytes32(0)) revert EmptyQuoteHash();
        if (instruction.settlementPlanHash == bytes32(0)) revert EmptySettlementPlanHash();
        if (block.timestamp > instruction.deadline) revert DeadlineExpired();
        if (instruction.payer != msg.sender) revert PayerMismatch();
        if (instruction.lines.length == 0) revert NoSettlementLines();

        uint256 lineTotal;
        bytes32 lineHash = _hashLines(instruction.lines);

        for (uint256 i = 0; i < instruction.lines.length; i++) {
            SettlementLine calldata line = instruction.lines[i];
            if (line.recipient == address(0)) revert InvalidRecipient();
            if (line.token != instruction.token) revert InvalidLineToken();
            if (line.amount == 0) revert InvalidLineAmount();
            lineTotal += line.amount;
        }

        if (lineTotal != instruction.grossAmount) revert LineTotalMismatch();

        executionHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                instruction.quoteHash,
                instruction.settlementPlanHash,
                instruction.payer,
                instruction.token,
                instruction.grossAmount,
                instruction.deadline,
                lineHash
            )
        );

        if (instruction.token == NATIVE_TOKEN) {
            if (msg.value != instruction.grossAmount) revert InvalidNativeValue();
            _executeNative(instruction.lines);
        } else {
            if (msg.value != 0) revert InvalidERC20Value();
            _executeERC20(instruction.payer, instruction.token, instruction.lines);
        }

        emit SettlementExecuted(
            instruction.quoteHash,
            instruction.settlementPlanHash,
            instruction.payer,
            instruction.token,
            instruction.grossAmount,
            executionHash
        );
    }

    function _executeNative(SettlementLine[] calldata lines) private {
        for (uint256 i = 0; i < lines.length; i++) {
            (bool ok,) = payable(lines[i].recipient).call{value: lines[i].amount}("");
            if (!ok) revert NativeTransferFailed();
        }
    }

    function _executeERC20(address payer, address token, SettlementLine[] calldata lines) private {
        IERC20 erc20 = IERC20(token);
        for (uint256 i = 0; i < lines.length; i++) {
            erc20.safeTransferFrom(payer, lines[i].recipient, lines[i].amount);
        }
    }

    function _hashLines(SettlementLine[] calldata lines) private pure returns (bytes32) {
        bytes32[] memory lineHashes = new bytes32[](lines.length);
        for (uint256 i = 0; i < lines.length; i++) {
            SettlementLine calldata line = lines[i];
            lineHashes[i] = keccak256(abi.encode(line.kind, line.recipient, line.token, line.amount, line.metadataHash));
        }
        return keccak256(abi.encodePacked(lineHashes));
    }
}
