// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ISettlementAdapter} from "../src/interfaces/ISettlementAdapter.sol";
import {SettlementAdapter} from "../src/SettlementAdapter.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SettlementAdapterTest is Test {
    SettlementAdapter adapter;
    MockUSDC usdc;

    address payer = makeAddr("payer");
    address merchant = makeAddr("merchant");
    address supplier = makeAddr("supplier");
    address tax = makeAddr("tax");
    address shipping = makeAddr("shipping");

    bytes32 quoteHash = keccak256("quote");
    bytes32 settlementPlanHash = keccak256("settlement-plan");

    function setUp() public {
        adapter = new SettlementAdapter();
        usdc = new MockUSDC();
        vm.deal(payer, 10 ether);
        usdc.mint(payer, 1_000_000);
    }

    function test_executeNativeSplitSettlement() public {
        ISettlementAdapter.SettlementLine[] memory lines = _nativeLines();
        ISettlementAdapter.SettlementInstruction memory instruction = ISettlementAdapter.SettlementInstruction({
            quoteHash: quoteHash,
            settlementPlanHash: settlementPlanHash,
            payer: payer,
            token: address(0),
            grossAmount: 1 ether,
            deadline: block.timestamp + 1 hours,
            lines: lines
        });

        vm.prank(payer);
        bytes32 executionHash = adapter.executeSettlement{value: 1 ether}(instruction);

        assertNotEq(executionHash, bytes32(0));
        assertEq(merchant.balance, 0.70 ether);
        assertEq(supplier.balance, 0.20 ether);
        assertEq(tax.balance, 0.08 ether);
        assertEq(shipping.balance, 0.02 ether);
    }

    function test_executeERC20SplitSettlement() public {
        ISettlementAdapter.SettlementLine[] memory lines = _erc20Lines();
        ISettlementAdapter.SettlementInstruction memory instruction = ISettlementAdapter.SettlementInstruction({
            quoteHash: quoteHash,
            settlementPlanHash: settlementPlanHash,
            payer: payer,
            token: address(usdc),
            grossAmount: 1_000_000,
            deadline: block.timestamp + 1 hours,
            lines: lines
        });

        vm.startPrank(payer);
        usdc.approve(address(adapter), 1_000_000);
        bytes32 executionHash = adapter.executeSettlement(instruction);
        vm.stopPrank();

        assertNotEq(executionHash, bytes32(0));
        assertEq(usdc.balanceOf(merchant), 700_000);
        assertEq(usdc.balanceOf(supplier), 200_000);
        assertEq(usdc.balanceOf(tax), 80_000);
        assertEq(usdc.balanceOf(shipping), 20_000);
        assertEq(usdc.balanceOf(payer), 0);
    }

    function test_revertIfLineTotalDoesNotMatchGrossAmount() public {
        ISettlementAdapter.SettlementLine[] memory lines = _erc20Lines();
        ISettlementAdapter.SettlementInstruction memory instruction = ISettlementAdapter.SettlementInstruction({
            quoteHash: quoteHash,
            settlementPlanHash: settlementPlanHash,
            payer: payer,
            token: address(usdc),
            grossAmount: 1_000_001,
            deadline: block.timestamp + 1 hours,
            lines: lines
        });

        vm.prank(payer);
        vm.expectRevert(SettlementAdapter.LineTotalMismatch.selector);
        adapter.executeSettlement(instruction);
    }

    function test_revertIfNativeValueDoesNotMatchGrossAmount() public {
        ISettlementAdapter.SettlementLine[] memory lines = _nativeLines();
        ISettlementAdapter.SettlementInstruction memory instruction = ISettlementAdapter.SettlementInstruction({
            quoteHash: quoteHash,
            settlementPlanHash: settlementPlanHash,
            payer: payer,
            token: address(0),
            grossAmount: 1 ether,
            deadline: block.timestamp + 1 hours,
            lines: lines
        });

        vm.prank(payer);
        vm.expectRevert(SettlementAdapter.InvalidNativeValue.selector);
        adapter.executeSettlement{value: 0.99 ether}(instruction);
    }

    function test_revertIfPayerMismatch() public {
        ISettlementAdapter.SettlementLine[] memory lines = _erc20Lines();
        ISettlementAdapter.SettlementInstruction memory instruction = ISettlementAdapter.SettlementInstruction({
            quoteHash: quoteHash,
            settlementPlanHash: settlementPlanHash,
            payer: payer,
            token: address(usdc),
            grossAmount: 1_000_000,
            deadline: block.timestamp + 1 hours,
            lines: lines
        });

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(SettlementAdapter.PayerMismatch.selector);
        adapter.executeSettlement(instruction);
    }

    function _nativeLines() internal view returns (ISettlementAdapter.SettlementLine[] memory lines) {
        lines = new ISettlementAdapter.SettlementLine[](4);
        lines[0] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.MERCHANT,
            recipient: merchant,
            token: address(0),
            amount: 0.70 ether,
            metadataHash: keccak256("merchant")
        });
        lines[1] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.SUPPLIER,
            recipient: supplier,
            token: address(0),
            amount: 0.20 ether,
            metadataHash: keccak256("supplier")
        });
        lines[2] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.TAX,
            recipient: tax,
            token: address(0),
            amount: 0.08 ether,
            metadataHash: keccak256("tax")
        });
        lines[3] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.SHIPPING,
            recipient: shipping,
            token: address(0),
            amount: 0.02 ether,
            metadataHash: keccak256("shipping")
        });
    }

    function _erc20Lines() internal view returns (ISettlementAdapter.SettlementLine[] memory lines) {
        lines = new ISettlementAdapter.SettlementLine[](4);
        lines[0] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.MERCHANT,
            recipient: merchant,
            token: address(usdc),
            amount: 700_000,
            metadataHash: keccak256("merchant")
        });
        lines[1] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.SUPPLIER,
            recipient: supplier,
            token: address(usdc),
            amount: 200_000,
            metadataHash: keccak256("supplier")
        });
        lines[2] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.TAX,
            recipient: tax,
            token: address(usdc),
            amount: 80_000,
            metadataHash: keccak256("tax")
        });
        lines[3] = ISettlementAdapter.SettlementLine({
            kind: ISettlementAdapter.LineKind.SHIPPING,
            recipient: shipping,
            token: address(usdc),
            amount: 20_000,
            metadataHash: keccak256("shipping")
        });
    }
}
