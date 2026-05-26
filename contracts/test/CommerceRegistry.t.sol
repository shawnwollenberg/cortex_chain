// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommerceRegistry} from "../src/CommerceRegistry.sol";

contract CommerceRegistryTest is Test {
    CommerceRegistry registry;

    address merchant = makeAddr("merchant");
    address agent = makeAddr("agent");
    address facilitator = makeAddr("facilitator");
    address stranger = makeAddr("stranger");
    address token = makeAddr("token");

    function setUp() public {
        registry = new CommerceRegistry();
    }

    function test_registerMerchantServiceQuoteReceiptAndDispute() public {
        vm.prank(facilitator);
        uint256 facilitatorId = registry.registerFacilitator(facilitator, "ipfs://facilitator", keccak256("facilitator"));
        assertEq(facilitatorId, 1);

        vm.startPrank(merchant);
        uint256 merchantId = registry.registerMerchant(merchant, "ipfs://merchant", keccak256("merchant"));
        uint256 serviceId = registry.registerService(
            merchantId,
            "weather.current",
            "ipfs://service",
            keccak256("service"),
            keccak256("weather")
        );

        uint256 expiresAt = block.timestamp + 1 hours;
        uint256 paymentNonce = 1;
        bytes32 resourceHash = keccak256("resource");
        bytes32 termsHash = keccak256("terms");
        bytes32 x402PayloadHash = keccak256("x402-payload");
        bytes32 quoteHash = registry.computeQuoteHash(
            merchantId,
            serviceId,
            agent,
            token,
            facilitator,
            1e6,
            CommerceRegistry.PaymentRail.X402,
            expiresAt,
            paymentNonce,
            resourceHash,
            termsHash,
            x402PayloadHash
        );
        registry.commitQuote(
            CommerceRegistry.QuoteCommitment({
                merchantId: merchantId,
                serviceNumericId: serviceId,
                agent: agent,
                token: token,
                facilitator: facilitator,
                amount: 1e6,
                paymentRail: CommerceRegistry.PaymentRail.X402,
                expiresAt: expiresAt,
                paymentNonce: paymentNonce,
                resourceHash: resourceHash,
                termsHash: termsHash,
                x402PayloadHash: x402PayloadHash
            })
        );
        vm.stopPrank();

        vm.prank(facilitator);
        uint256 receiptId = registry.recordReceipt(quoteHash, keccak256("result"));
        assertEq(receiptId, 1);
        assertTrue(registry.getQuote(quoteHash).settled);
        assertEq(registry.getQuote(quoteHash).protocolFeeBps, 0);
        assertEq(registry.getQuote(quoteHash).protocolFeeAmount, 0);
        assertEq(uint8(registry.getQuote(quoteHash).paymentRail), uint8(CommerceRegistry.PaymentRail.X402));
        assertEq(registry.getReceipt(receiptId).protocolFeeBps, 0);
        assertEq(registry.getReceipt(receiptId).protocolFeeAmount, 0);
        assertEq(uint8(registry.getReceipt(receiptId).paymentRail), uint8(CommerceRegistry.PaymentRail.X402));

        vm.prank(merchant);
        registry.recordFulfillment(receiptId, keccak256("fulfillment"));
        assertEq(registry.getReceipt(receiptId).fulfillmentHash, keccak256("fulfillment"));

        vm.prank(agent);
        uint256 disputeId = registry.openDispute(receiptId, keccak256("timeout"));
        assertEq(disputeId, 1);

        vm.prank(merchant);
        registry.resolveDispute(disputeId, CommerceRegistry.DisputeStatus.RESOLVED, keccak256("refund-issued"));
        assertEq(uint8(registry.getDispute(disputeId).status), uint8(CommerceRegistry.DisputeStatus.RESOLVED));

        vm.prank(agent);
        uint256 signalId = registry.recordTrustSignal(
            CommerceRegistry.SignalSubject.MERCHANT,
            merchantId,
            CommerceRegistry.SignalKind.RISK,
            keccak256("risk-signal")
        );
        assertEq(registry.getTrustSignal(signalId).reporter, agent);
    }

    function test_transferQuoteAllowsZeroFacilitatorAndMerchantReceipt() public {
        (uint256 merchantId, uint256 serviceId) = _registerMerchantAndService();

        bytes32 quoteHash = _commitQuote(
            merchantId,
            serviceId,
            address(0),
            CommerceRegistry.PaymentRail.TRANSFER,
            bytes32(0),
            1
        );

        vm.prank(merchant);
        uint256 receiptId = registry.recordReceipt(quoteHash, keccak256("transfer-settled"));

        assertEq(receiptId, 1);
        assertTrue(registry.getQuote(quoteHash).settled);
        assertEq(registry.getReceipt(receiptId).facilitator, address(0));
        assertEq(uint8(registry.getReceipt(receiptId).paymentRail), uint8(CommerceRegistry.PaymentRail.TRANSFER));
    }

    function test_swapQuoteAllowsZeroFacilitatorAndAgentReceipt() public {
        (uint256 merchantId, uint256 serviceId) = _registerMerchantAndService();

        bytes32 quoteHash = _commitQuote(
            merchantId,
            serviceId,
            address(0),
            CommerceRegistry.PaymentRail.SWAP,
            bytes32(0),
            2
        );

        vm.prank(agent);
        uint256 receiptId = registry.recordReceipt(quoteHash, keccak256("swap-settled"));

        assertEq(receiptId, 1);
        assertTrue(registry.getQuote(quoteHash).settled);
        assertEq(registry.getReceipt(receiptId).facilitator, address(0));
        assertEq(uint8(registry.getReceipt(receiptId).paymentRail), uint8(CommerceRegistry.PaymentRail.SWAP));
    }

    function test_transferQuoteRejectsUnauthorizedReceiptRecorder() public {
        (uint256 merchantId, uint256 serviceId) = _registerMerchantAndService();
        bytes32 quoteHash = _commitQuote(
            merchantId,
            serviceId,
            address(0),
            CommerceRegistry.PaymentRail.TRANSFER,
            bytes32(0),
            3
        );

        vm.prank(stranger);
        vm.expectRevert(CommerceRegistry.Unauthorized.selector);
        registry.recordReceipt(quoteHash, keccak256("fake-settlement"));
    }

    function test_facilitatorQuoteRequiresActiveFacilitator() public {
        (uint256 merchantId, uint256 serviceId) = _registerMerchantAndService();

        vm.prank(merchant);
        vm.expectRevert(CommerceRegistry.FacilitatorInactive.selector);
        registry.commitQuote(
            CommerceRegistry.QuoteCommitment({
                merchantId: merchantId,
                serviceNumericId: serviceId,
                agent: agent,
                token: token,
                facilitator: facilitator,
                amount: 1e6,
                paymentRail: CommerceRegistry.PaymentRail.FACILITATOR,
                expiresAt: block.timestamp + 1 hours,
                paymentNonce: 4,
                resourceHash: keccak256("resource"),
                termsHash: keccak256("terms"),
                x402PayloadHash: bytes32(0)
            })
        );
    }

    function test_facilitatorQuoteAllowsFacilitatorReceipt() public {
        vm.prank(facilitator);
        registry.registerFacilitator(facilitator, "ipfs://facilitator", keccak256("facilitator"));
        (uint256 merchantId, uint256 serviceId) = _registerMerchantAndService();
        bytes32 quoteHash = _commitQuote(
            merchantId,
            serviceId,
            facilitator,
            CommerceRegistry.PaymentRail.FACILITATOR,
            bytes32(0),
            5
        );

        vm.prank(facilitator);
        uint256 receiptId = registry.recordReceipt(quoteHash, keccak256("facilitator-settled"));

        assertEq(receiptId, 1);
        assertEq(registry.getReceipt(receiptId).facilitator, facilitator);
        assertEq(uint8(registry.getReceipt(receiptId).paymentRail), uint8(CommerceRegistry.PaymentRail.FACILITATOR));
    }

    function test_x402Quote_revertIfFacilitatorNotRegistered() public {
        vm.prank(merchant);
        uint256 merchantId = registry.registerMerchant(merchant, "ipfs://merchant", keccak256("merchant"));
        vm.prank(merchant);
        uint256 serviceId = registry.registerService(
            merchantId,
            "weather.current",
            "ipfs://service",
            keccak256("service"),
            keccak256("weather")
        );

        vm.prank(merchant);
        vm.expectRevert(CommerceRegistry.FacilitatorInactive.selector);
        registry.commitQuote(
            CommerceRegistry.QuoteCommitment({
                merchantId: merchantId,
                serviceNumericId: serviceId,
                agent: agent,
                token: token,
                facilitator: facilitator,
                amount: 1e6,
                paymentRail: CommerceRegistry.PaymentRail.X402,
                expiresAt: block.timestamp + 1 hours,
                paymentNonce: 1,
                resourceHash: keccak256("resource"),
                termsHash: keccak256("terms"),
                x402PayloadHash: keccak256("x402-payload")
            })
        );
    }

    function _registerMerchantAndService() internal returns (uint256 merchantId, uint256 serviceId) {
        vm.prank(merchant);
        merchantId = registry.registerMerchant(merchant, "ipfs://merchant", keccak256("merchant"));
        vm.prank(merchant);
        serviceId = registry.registerService(
            merchantId,
            "weather.current",
            "ipfs://service",
            keccak256("service"),
            keccak256("weather")
        );
    }

    function _commitQuote(
        uint256 merchantId,
        uint256 serviceId,
        address quoteFacilitator,
        CommerceRegistry.PaymentRail rail,
        bytes32 x402PayloadHash,
        uint256 paymentNonce
    ) internal returns (bytes32 quoteHash) {
        CommerceRegistry.QuoteCommitment memory commitment = CommerceRegistry.QuoteCommitment({
            merchantId: merchantId,
            serviceNumericId: serviceId,
            agent: agent,
            token: token,
            facilitator: quoteFacilitator,
            amount: 1e6,
            paymentRail: rail,
            expiresAt: block.timestamp + 1 hours,
            paymentNonce: paymentNonce,
            resourceHash: keccak256("resource"),
            termsHash: keccak256("terms"),
            x402PayloadHash: x402PayloadHash
        });
        quoteHash = registry.computeQuoteHash(commitment);

        vm.prank(merchant);
        registry.commitQuote(commitment);
    }
}
