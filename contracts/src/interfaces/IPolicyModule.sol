// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPolicyModule {
    struct SpendLimit {
        uint256 maxPerDay;
        uint256 spentToday;
        uint48 lastResetTimestamp;
    }

    event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay);
    event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed);
    event FunctionAllowlistUpdated(address indexed account, address indexed target, bytes4 selector, bool allowed);
    event SpendRecorded(address indexed account, address indexed token, uint256 amount, uint256 dailyTotal);

    error Unauthorized();
    error TargetNotAllowed(address target);
    error FunctionNotAllowed(address target, bytes4 selector);
    error DailySpendLimitExceeded(address token, uint256 attempted, uint256 remaining);
    error DelegateCallNotAllowed();

    function setSpendLimit(address token, uint256 maxPerDay) external;
    function setTargetAllowed(address target, bool allowed) external;
    function setFunctionAllowed(address target, bytes4 selector, bool allowed) external;
    function setUseFunctionAllowlist(bool enabled) external;

    function checkTransaction(address target, uint256 value, bytes calldata data) external view;
    function recordSpend(address token, uint256 amount) external;

    function getSpendLimit(address account, address token) external view returns (SpendLimit memory);
    function getSpentToday(address account, address token) external view returns (uint256);
    function isTargetAllowed(address account, address target) external view returns (bool);
    function isFunctionAllowed(address account, address target, bytes4 selector) external view returns (bool);
}
