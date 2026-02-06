// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Intent, Fill, IntentStatus} from "../libraries/IntentTypes.sol";

interface IIntentBook {
    event IntentSubmitted(uint256 indexed intentId, address indexed owner, uint256 nonce);
    event IntentCancelled(uint256 indexed intentId);
    event IntentFilled(uint256 indexed intentId, address indexed solver, uint256 amountIn, uint256 amountOut);

    error Unauthorized();
    error InvalidNonce();
    error IntentExpired();
    error IntentNotOpen();
    error ConstraintViolation();
    error InvalidSlippage();
    error InvalidDeadline();
    error InvalidSignature();

    function submitIntent(Intent calldata intent, uint8 v, bytes32 r, bytes32 s) external returns (uint256 intentId);

    function cancelIntent(uint256 intentId) external;

    function fillIntent(uint256 intentId, Fill calldata fill) external;

    function getIntent(uint256 intentId) external view returns (Intent memory);

    function getIntentStatus(uint256 intentId) external view returns (IntentStatus);
}
