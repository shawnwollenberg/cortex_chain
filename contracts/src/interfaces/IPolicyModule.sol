// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPolicyModule {
    struct SpendLimit {
        uint256 maxPerDay;
        uint256 spentToday;
        uint48 lastResetTimestamp;
    }

    struct PaymentPolicy {
        uint256 maxPerPayment;
        uint256 maxPerDay;
        uint256 spentToday;
        uint48 lastResetTimestamp;
        bool allowed;
    }

    event SpendLimitSet(address indexed account, address indexed token, uint256 maxPerDay);
    event TargetAllowlistUpdated(address indexed account, address indexed target, bool allowed);
    event FunctionAllowlistUpdated(address indexed account, address indexed target, bytes4 selector, bool allowed);
    event FunctionAllowlistModeUpdated(address indexed account, bool enabled);
    event SpendRecorded(address indexed account, address indexed token, uint256 amount, uint256 dailyTotal);
    event PaymentPolicySet(
        address indexed account,
        address indexed merchant,
        address indexed token,
        address facilitator,
        uint256 maxPerPayment,
        uint256 maxPerDay,
        bool allowed
    );
    event SignedPaymentRecorded(
        address indexed account,
        address indexed merchant,
        address indexed token,
        address facilitator,
        uint256 amount,
        bytes32 paymentHash,
        uint256 dailyTotal
    );
    event GuardianSet(address indexed account, address indexed guardian);
    event AccountFrozen(address indexed account, bool frozen);

    error Unauthorized();
    error AccountFrozenError(address account);
    error TargetNotAllowed(address target);
    error FunctionNotAllowed(address target, bytes4 selector);
    error DailySpendLimitExceeded(address token, uint256 attempted, uint256 remaining);
    error PaymentNotAllowed(address merchant, address token, address facilitator);
    error PaymentAmountExceeded(address token, uint256 attempted, uint256 remaining);
    error PaymentAlreadyRecorded(bytes32 paymentHash);
    error DelegateCallNotAllowed();

    function setSpendLimit(address token, uint256 maxPerDay) external;
    function setTargetAllowed(address target, bool allowed) external;
    function setFunctionAllowed(address target, bytes4 selector, bool allowed) external;
    function setUseFunctionAllowlist(bool enabled) external;
    function setGuardian(address guardian) external;
    function setAccountFrozen(address account, bool frozen) external;
    function setPaymentPolicy(
        address merchant,
        address token,
        address facilitator,
        uint256 maxPerPayment,
        uint256 maxPerDay,
        bool allowed
    ) external;

    function checkTransaction(address target, uint256 value, bytes calldata data) external view;
    function recordSpend(address token, uint256 amount) external;
    function checkSignedPayment(address merchant, address token, address facilitator, uint256 amount) external view;
    function recordSignedPayment(
        address merchant,
        address token,
        address facilitator,
        uint256 amount,
        bytes32 paymentHash
    ) external;
    function getTokenSpend(address target, bytes calldata data) external pure returns (address token, uint256 amount);

    function getSpendLimit(address account, address token) external view returns (SpendLimit memory);
    function getPaymentPolicy(address account, address merchant, address token, address facilitator)
        external
        view
        returns (PaymentPolicy memory);
    function getSpentToday(address account, address token) external view returns (uint256);
    function isTargetAllowed(address account, address target) external view returns (bool);
    function isFunctionAllowed(address account, address target, bytes4 selector) external view returns (bool);
    function guardianOf(address account) external view returns (address);
    function isAccountFrozen(address account) external view returns (bool);
}
