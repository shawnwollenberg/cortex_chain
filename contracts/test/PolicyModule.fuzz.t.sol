// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyModule} from "../src/PolicyModule.sol";
import {IPolicyModule} from "../src/interfaces/IPolicyModule.sol";

contract PolicyModuleFuzzTest is Test {
    PolicyModule public module;

    address public account = makeAddr("account");
    address public other = makeAddr("other");

    function setUp() public {
        module = new PolicyModule();
    }

    // ── Spend limit amount fuzzing ───────────────────────────────────

    function testFuzz_recordSpend_withinLimit(uint256 maxPerDay, uint256 amount) public {
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        amount = bound(amount, 0, maxPerDay);

        vm.startPrank(account);
        module.setSpendLimit(address(0), maxPerDay);
        module.recordSpend(address(0), amount);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), amount);
    }

    function testFuzz_recordSpend_exceedsLimit(uint256 maxPerDay, uint256 amount) public {
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        amount = bound(amount, maxPerDay + 1, type(uint256).max);

        vm.startPrank(account);
        module.setSpendLimit(address(0), maxPerDay);

        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), amount, maxPerDay)
        );
        module.recordSpend(address(0), amount);
        vm.stopPrank();
    }

    function testFuzz_recordSpend_cumulativeExceedsLimit(uint256 maxPerDay, uint256 first, uint256 second) public {
        maxPerDay = bound(maxPerDay, 2, type(uint128).max);
        first = bound(first, 1, maxPerDay - 1);
        uint256 remaining = maxPerDay - first;
        second = bound(second, remaining + 1, type(uint128).max);

        vm.startPrank(account);
        module.setSpendLimit(address(0), maxPerDay);
        module.recordSpend(address(0), first);

        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), second, remaining)
        );
        module.recordSpend(address(0), second);
        vm.stopPrank();
    }

    // ── Rolling window fuzzing ───────────────────────────────────────

    function testFuzz_rollingWindow_resetsAfter24h(uint256 maxPerDay, uint256 amount, uint256 warpSeconds) public {
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        amount = bound(amount, 1, maxPerDay);
        warpSeconds = bound(warpSeconds, 1 days, 365 days);

        vm.startPrank(account);
        module.setSpendLimit(address(0), maxPerDay);
        module.recordSpend(address(0), amount);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, address(0)), amount);

        vm.warp(block.timestamp + warpSeconds);

        // After window expires, spent should be 0
        assertEq(module.getSpentToday(account, address(0)), 0);

        // Should be able to spend again
        vm.prank(account);
        module.recordSpend(address(0), amount);
        assertEq(module.getSpentToday(account, address(0)), amount);
    }

    function testFuzz_rollingWindow_doesNotResetBefore24h(uint256 maxPerDay, uint256 amount, uint256 warpSeconds)
        public
    {
        // Start at a reasonable timestamp so lastResetTimestamp is properly initialized
        vm.warp(1 days + 1);

        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        amount = bound(amount, 1, maxPerDay);
        warpSeconds = bound(warpSeconds, 0, 1 days - 1);

        vm.startPrank(account);
        module.setSpendLimit(address(0), maxPerDay);
        module.recordSpend(address(0), amount);
        vm.stopPrank();

        vm.warp(block.timestamp + warpSeconds);

        // Still within window
        assertEq(module.getSpentToday(account, address(0)), amount);
    }

    // ── Target allowlist fuzzing ─────────────────────────────────────

    function testFuzz_targetAllowlist(address target, bool allowed) public {
        vm.assume(target != address(0));

        vm.prank(account);
        module.setTargetAllowed(target, allowed);

        assertEq(module.isTargetAllowed(account, target), allowed);
    }

    function testFuzz_checkTransaction_disallowedTarget(address target) public {
        vm.assume(target != address(0));

        // Target not on allowlist — should revert
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(IPolicyModule.TargetNotAllowed.selector, target));
        module.checkTransaction(target, 0, "");
    }

    // ── Function allowlist fuzzing ───────────────────────────────────

    function testFuzz_functionAllowlist(address target, bytes4 selector, bool allowed) public {
        vm.assume(target != address(0));

        vm.startPrank(account);
        module.setFunctionAllowed(target, selector, allowed);
        vm.stopPrank();

        assertEq(module.isFunctionAllowed(account, target, selector), allowed);
    }

    // ── checkTransaction with ETH value fuzzing ──────────────────────

    function testFuzz_checkTransaction_ethValueWithinLimit(uint256 maxPerDay, uint256 value) public {
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        value = bound(value, 0, maxPerDay);

        address target = makeAddr("target");

        vm.startPrank(account);
        module.setTargetAllowed(target, true);
        module.setSpendLimit(address(0), maxPerDay);
        // Should not revert
        module.checkTransaction(target, value, "");
        vm.stopPrank();
    }

    function testFuzz_checkTransaction_ethValueExceedsLimit(uint256 maxPerDay, uint256 value) public {
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        value = bound(value, maxPerDay + 1, type(uint256).max);

        address target = makeAddr("target");

        vm.startPrank(account);
        module.setTargetAllowed(target, true);
        module.setSpendLimit(address(0), maxPerDay);

        vm.expectRevert(
            abi.encodeWithSelector(IPolicyModule.DailySpendLimitExceeded.selector, address(0), value, maxPerDay)
        );
        module.checkTransaction(target, value, "");
        vm.stopPrank();
    }

    // ── Per-account isolation fuzzing ────────────────────────────────

    function testFuzz_perAccountIsolation(address accountA, address accountB, uint256 maxPerDay) public {
        vm.assume(accountA != accountB);
        vm.assume(accountA != address(0));
        vm.assume(accountB != address(0));
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);

        // Only accountA sets a limit
        vm.prank(accountA);
        module.setSpendLimit(address(0), maxPerDay);

        // accountB has no limit — should be free
        assertEq(module.getSpendLimit(accountB, address(0)).maxPerDay, 0);
        assertEq(module.getSpendLimit(accountA, address(0)).maxPerDay, maxPerDay);

        // accountB can spend freely
        vm.prank(accountB);
        module.recordSpend(address(0), type(uint128).max);
    }

    // ── Multiple token isolation fuzzing ─────────────────────────────

    function testFuzz_multipleTokenIsolation(address tokenA, address tokenB, uint256 limitA, uint256 limitB) public {
        vm.assume(tokenA != tokenB);
        limitA = bound(limitA, 1, type(uint128).max);
        limitB = bound(limitB, 1, type(uint128).max);

        vm.startPrank(account);
        module.setSpendLimit(tokenA, limitA);
        module.setSpendLimit(tokenB, limitB);

        // Spend full limit on tokenA
        module.recordSpend(tokenA, limitA);

        // tokenB should be unaffected
        module.recordSpend(tokenB, limitB);
        vm.stopPrank();

        assertEq(module.getSpentToday(account, tokenA), limitA);
        assertEq(module.getSpentToday(account, tokenB), limitB);
    }
}
