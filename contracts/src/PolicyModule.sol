// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPolicyModule} from "./interfaces/IPolicyModule.sol";

contract PolicyModule is IPolicyModule {
    mapping(address account => mapping(address token => SpendLimit)) private _spendLimits;
    mapping(address account => mapping(address target => bool)) private _allowedTargets;
    mapping(address account => mapping(address target => mapping(bytes4 => bool))) private _allowedFunctions;
    mapping(address account => bool) private _usesFunctionAllowlist;

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
    }

    // ── Validation ───────────────────────────────────────────────────

    function checkTransaction(address target, uint256 value, bytes calldata data) external view {
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

    function isTargetAllowed(address account, address target) external view returns (bool) {
        return _allowedTargets[account][target];
    }

    function isFunctionAllowed(address account, address target, bytes4 selector) external view returns (bool) {
        return _allowedFunctions[account][target][selector];
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
}
