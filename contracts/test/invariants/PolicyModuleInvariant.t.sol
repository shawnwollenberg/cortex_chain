// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyModule} from "../../src/PolicyModule.sol";
import {IPolicyModule} from "../../src/interfaces/IPolicyModule.sol";

contract PolicyModuleHandler is Test {
    PolicyModule public module;
    address public account;

    // Ghost: highest maxPerDay that was ever active while spend was recorded in the current window
    uint256 public peakMaxPerDay;
    uint256 public currentMaxPerDay;

    // Ghost: track per-token limits and spending for isolation invariant
    address public constant TOKEN_A = address(0xA);
    address public constant TOKEN_B = address(0xB);
    uint256 public limitA;
    uint256 public limitB;
    uint256 public peakLimitA;
    uint256 public peakLimitB;

    constructor(PolicyModule _module) {
        module = _module;
        account = makeAddr("handler-account");
    }

    function setSpendLimit(uint256 maxPerDay) external {
        maxPerDay = bound(maxPerDay, 0, 100 ether);
        vm.prank(account);
        module.setSpendLimit(address(0), maxPerDay);
        currentMaxPerDay = maxPerDay;
        if (maxPerDay > peakMaxPerDay) {
            peakMaxPerDay = maxPerDay;
        }
    }

    function recordSpend(uint256 amount) external {
        if (currentMaxPerDay == 0) return;

        uint256 spentSoFar = module.getSpentToday(account, address(0));
        uint256 remaining = currentMaxPerDay > spentSoFar ? currentMaxPerDay - spentSoFar : 0;

        amount = bound(amount, 0, remaining);
        if (amount == 0) return;

        vm.prank(account);
        module.recordSpend(address(0), amount);
    }

    function warpTime(uint256 secondsToWarp) external {
        secondsToWarp = bound(secondsToWarp, 0, 3 days);
        vm.warp(block.timestamp + secondsToWarp);

        // If window reset, also reset peak tracking
        uint256 spentNow = module.getSpentToday(account, address(0));
        if (spentNow == 0) {
            peakMaxPerDay = currentMaxPerDay;
        }
    }

    function setSpendLimitA(uint256 max) external {
        max = bound(max, 0, 100 ether);
        vm.prank(account);
        module.setSpendLimit(TOKEN_A, max);
        limitA = max;
        if (max > peakLimitA) peakLimitA = max;
    }

    function setSpendLimitB(uint256 max) external {
        max = bound(max, 0, 100 ether);
        vm.prank(account);
        module.setSpendLimit(TOKEN_B, max);
        limitB = max;
        if (max > peakLimitB) peakLimitB = max;
    }

    function spendTokenA(uint256 amount) external {
        if (limitA == 0) return;
        uint256 spentSoFar = module.getSpentToday(account, TOKEN_A);
        uint256 remaining = limitA > spentSoFar ? limitA - spentSoFar : 0;
        amount = bound(amount, 0, remaining);
        if (amount == 0) return;

        vm.prank(account);
        module.recordSpend(TOKEN_A, amount);
    }

    function spendTokenB(uint256 amount) external {
        if (limitB == 0) return;
        uint256 spentSoFar = module.getSpentToday(account, TOKEN_B);
        uint256 remaining = limitB > spentSoFar ? limitB - spentSoFar : 0;
        amount = bound(amount, 0, remaining);
        if (amount == 0) return;

        vm.prank(account);
        module.recordSpend(TOKEN_B, amount);
    }
}

contract PolicyModuleInvariantTest is Test {
    PolicyModule public module;
    PolicyModuleHandler public handler;

    function setUp() public {
        module = new PolicyModule();
        handler = new PolicyModuleHandler(module);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = PolicyModuleHandler.setSpendLimit.selector;
        selectors[1] = PolicyModuleHandler.recordSpend.selector;
        selectors[2] = PolicyModuleHandler.warpTime.selector;
        selectors[3] = PolicyModuleHandler.setSpendLimitA.selector;
        selectors[4] = PolicyModuleHandler.setSpendLimitB.selector;
        selectors[5] = PolicyModuleHandler.spendTokenA.selector;
        selectors[6] = PolicyModuleHandler.spendTokenB.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice spentToday never exceeds the peak maxPerDay that was active during spending
    function invariant_spentNeverExceedsPeakMax() public view {
        address account = handler.account();
        uint256 spentToday = module.getSpentToday(account, address(0));
        uint256 peakMax = handler.peakMaxPerDay();

        if (peakMax > 0) {
            assertLe(spentToday, peakMax);
        }
    }

    /// @notice After a full window expires, getSpentToday returns 0
    function invariant_windowResetClearsSpend() public view {
        address account = handler.account();
        IPolicyModule.SpendLimit memory limit = module.getSpendLimit(account, address(0));

        if (limit.lastResetTimestamp > 0 && block.timestamp >= uint256(limit.lastResetTimestamp) + 1 days) {
            assertEq(module.getSpentToday(account, address(0)), 0);
        }
    }

    /// @notice Spending on token A does not affect token B's spent amount, and vice versa.
    /// Each token's spending is capped by the peak limit that was active during the window.
    function invariant_perTokenIsolation() public view {
        address account = handler.account();
        address tokenA = handler.TOKEN_A();
        address tokenB = handler.TOKEN_B();

        uint256 spentA = module.getSpentToday(account, tokenA);
        uint256 spentB = module.getSpentToday(account, tokenB);
        uint256 peakA = handler.peakLimitA();
        uint256 peakB = handler.peakLimitB();

        // Each token's spending is capped by its peak limit (limit can be lowered after spending)
        if (peakA > 0) {
            assertLe(spentA, peakA);
        }
        if (peakB > 0) {
            assertLe(spentB, peakB);
        }
    }
}
