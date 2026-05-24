// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPolicyModule} from "./interfaces/IPolicyModule.sol";

contract PolicyModule is IPolicyModule {
    bytes4 private constant ERC20_TRANSFER = 0xa9059cbb;
    bytes4 private constant ERC20_APPROVE = 0x095ea7b3;
    bytes4 private constant ERC20_TRANSFER_FROM = 0x23b872dd;

    mapping(address account => mapping(address token => SpendLimit)) private _spendLimits;
    mapping(address account => mapping(address target => bool)) private _allowedTargets;
    mapping(address account => mapping(address target => mapping(bytes4 => bool))) private _allowedFunctions;
    mapping(address account => bool) private _usesFunctionAllowlist;
    mapping(address account => address guardian) private _guardians;
    mapping(address account => bool frozen) private _frozenAccounts;
    mapping(address account => mapping(address merchant => mapping(address token => mapping(address facilitator => PaymentPolicy))))
        private _paymentPolicies;
    mapping(address account => mapping(bytes32 paymentHash => bool used)) private _usedPaymentHashes;

    modifier onlyAccount() {
        // msg.sender IS the account — the account calls PolicyModule directly
        _;
    }

    // ── Configuration (called by the account itself) ─────────────────

    function setSpendLimit(address token, uint256 maxPerDay) external {
        _spendLimits[msg.sender][token].maxPerDay = maxPerDay;
        emit SpendLimitSet(msg.sender, token, maxPerDay);
    }

    function setTargetAllowed(address target, bool allowed) external {
        _allowedTargets[msg.sender][target] = allowed;
        emit TargetAllowlistUpdated(msg.sender, target, allowed);
    }

    function setFunctionAllowed(address target, bytes4 selector, bool allowed) external {
        _allowedFunctions[msg.sender][target][selector] = allowed;
        emit FunctionAllowlistUpdated(msg.sender, target, selector, allowed);
    }

    function setUseFunctionAllowlist(bool enabled) external {
        _usesFunctionAllowlist[msg.sender] = enabled;
        emit FunctionAllowlistModeUpdated(msg.sender, enabled);
    }

    function setGuardian(address guardian) external {
        _guardians[msg.sender] = guardian;
        emit GuardianSet(msg.sender, guardian);
    }

    function setAccountFrozen(address account, bool frozen) external {
        if (msg.sender != account && msg.sender != _guardians[account]) revert Unauthorized();
        _frozenAccounts[account] = frozen;
        emit AccountFrozen(account, frozen);
    }

    function setPaymentPolicy(
        address merchant,
        address token,
        address facilitator,
        uint256 maxPerPayment,
        uint256 maxPerDay,
        bool allowed
    ) external {
        PaymentPolicy storage policy = _paymentPolicies[msg.sender][merchant][token][facilitator];
        policy.maxPerPayment = maxPerPayment;
        policy.maxPerDay = maxPerDay;
        policy.allowed = allowed;
        if (policy.lastResetTimestamp == 0) {
            policy.lastResetTimestamp = uint48(block.timestamp);
        }
        emit PaymentPolicySet(msg.sender, merchant, token, facilitator, maxPerPayment, maxPerDay, allowed);
    }

    // ── Validation ───────────────────────────────────────────────────

    function checkTransaction(address target, uint256 value, bytes calldata data) external view {
        if (_frozenAccounts[msg.sender]) revert AccountFrozenError(msg.sender);

        // 1. Target allowlist
        if (!_allowedTargets[msg.sender][target]) {
            revert TargetNotAllowed(target);
        }

        // 2. Function selector allowlist (opt-in)
        if (_usesFunctionAllowlist[msg.sender] && data.length >= 4) {
            bytes4 selector = bytes4(data[:4]);
            if (!_allowedFunctions[msg.sender][target][selector]) {
                revert FunctionNotAllowed(target, selector);
            }
        }

        // 3. ETH spend limit check (dry-run, no mutation)
        if (value > 0) {
            _checkSpendLimit(msg.sender, address(0), value);
        }

        (address token, uint256 tokenAmount) = _tokenSpend(target, data);
        if (tokenAmount > 0) {
            _checkSpendLimit(msg.sender, token, tokenAmount);
        }
    }

    function recordSpend(address token, uint256 amount) external {
        SpendLimit storage limit = _spendLimits[msg.sender][token];

        // No limit configured — allow freely
        if (limit.maxPerDay == 0) return;

        // Reset rolling window if 24h has elapsed
        if (block.timestamp >= uint256(limit.lastResetTimestamp) + 1 days) {
            limit.spentToday = 0;
            limit.lastResetTimestamp = uint48(block.timestamp);
        }

        uint256 newTotal = limit.spentToday + amount;
        uint256 remaining = limit.maxPerDay - limit.spentToday;
        if (newTotal > limit.maxPerDay) {
            revert DailySpendLimitExceeded(token, amount, remaining);
        }

        limit.spentToday = newTotal;
        emit SpendRecorded(msg.sender, token, amount, newTotal);
    }

    function checkSignedPayment(address merchant, address token, address facilitator, uint256 amount) external view {
        if (_frozenAccounts[msg.sender]) revert AccountFrozenError(msg.sender);
        PaymentPolicy memory policy = _paymentPolicies[msg.sender][merchant][token][facilitator];
        if (block.timestamp >= uint256(policy.lastResetTimestamp) + 1 days) {
            policy.spentToday = 0;
        }
        _checkPaymentPolicy(policy, merchant, token, facilitator, amount);
    }

    function recordSignedPayment(
        address merchant,
        address token,
        address facilitator,
        uint256 amount,
        bytes32 paymentHash
    ) external {
        PaymentPolicy storage policy = _paymentPolicies[msg.sender][merchant][token][facilitator];
        if (_frozenAccounts[msg.sender]) revert AccountFrozenError(msg.sender);
        if (_usedPaymentHashes[msg.sender][paymentHash]) revert PaymentAlreadyRecorded(paymentHash);
        if (block.timestamp >= uint256(policy.lastResetTimestamp) + 1 days) {
            policy.spentToday = 0;
            policy.lastResetTimestamp = uint48(block.timestamp);
        }
        _checkPaymentPolicy(policy, merchant, token, facilitator, amount);

        policy.spentToday += amount;
        _usedPaymentHashes[msg.sender][paymentHash] = true;
        emit SignedPaymentRecorded(msg.sender, merchant, token, facilitator, amount, paymentHash, policy.spentToday);
    }

    // ── View functions ───────────────────────────────────────────────

    function getSpendLimit(address account, address token) external view returns (SpendLimit memory) {
        return _spendLimits[account][token];
    }

    function getSpentToday(address account, address token) external view returns (uint256) {
        SpendLimit memory limit = _spendLimits[account][token];
        // If window has elapsed, effective spentToday is 0
        if (block.timestamp >= uint256(limit.lastResetTimestamp) + 1 days) {
            return 0;
        }
        return limit.spentToday;
    }

    function getPaymentPolicy(address account, address merchant, address token, address facilitator)
        external
        view
        returns (PaymentPolicy memory)
    {
        PaymentPolicy memory policy = _paymentPolicies[account][merchant][token][facilitator];
        if (block.timestamp >= uint256(policy.lastResetTimestamp) + 1 days) {
            policy.spentToday = 0;
        }
        return policy;
    }

    function isTargetAllowed(address account, address target) external view returns (bool) {
        return _allowedTargets[account][target];
    }

    function isFunctionAllowed(address account, address target, bytes4 selector) external view returns (bool) {
        return _allowedFunctions[account][target][selector];
    }

    function guardianOf(address account) external view returns (address) {
        return _guardians[account];
    }

    function isAccountFrozen(address account) external view returns (bool) {
        return _frozenAccounts[account];
    }

    function getTokenSpend(address target, bytes calldata data) external pure returns (address token, uint256 amount) {
        return _tokenSpend(target, data);
    }

    // ── Internal ─────────────────────────────────────────────────────

    function _checkSpendLimit(address account, address token, uint256 amount) internal view {
        SpendLimit memory limit = _spendLimits[account][token];

        // No limit configured — allow freely
        if (limit.maxPerDay == 0) return;

        uint256 currentSpent = limit.spentToday;
        // Reset rolling window if 24h has elapsed
        if (block.timestamp >= uint256(limit.lastResetTimestamp) + 1 days) {
            currentSpent = 0;
        }

        uint256 remaining = limit.maxPerDay - currentSpent;
        if (currentSpent + amount > limit.maxPerDay) {
            revert DailySpendLimitExceeded(token, amount, remaining);
        }
    }

    function _checkPaymentPolicy(
        PaymentPolicy memory policy,
        address merchant,
        address token,
        address facilitator,
        uint256 amount
    ) internal pure {
        if (!policy.allowed) revert PaymentNotAllowed(merchant, token, facilitator);
        if (policy.maxPerPayment > 0 && amount > policy.maxPerPayment) {
            revert PaymentAmountExceeded(token, amount, policy.maxPerPayment);
        }

        uint256 currentSpent = policy.spentToday;
        if (policy.lastResetTimestamp == 0) {
            currentSpent = 0;
        }
        uint256 remaining = policy.maxPerDay > currentSpent ? policy.maxPerDay - currentSpent : 0;
        if (policy.maxPerDay > 0 && currentSpent + amount > policy.maxPerDay) {
            revert PaymentAmountExceeded(token, amount, remaining);
        }
    }

    function _tokenSpend(address target, bytes calldata data) internal pure returns (address token, uint256 amount) {
        if (data.length < 4) return (address(0), 0);

        bytes4 selector = bytes4(data[:4]);

        if (selector == ERC20_TRANSFER || selector == ERC20_APPROVE) {
            if (data.length < 68) return (address(0), 0);
            amount = abi.decode(data[36:68], (uint256));
            return (target, amount);
        }

        if (selector == ERC20_TRANSFER_FROM) {
            if (data.length < 100) return (address(0), 0);
            amount = abi.decode(data[68:100], (uint256));
            return (target, amount);
        }

        return (address(0), 0);
    }
}
