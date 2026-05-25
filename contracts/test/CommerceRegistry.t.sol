// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommerceRegistry} from "../src/CommerceRegistry.sol";

contract CommerceRegistryTest is Test {
    CommerceRegistry registry;

    address merchant = makeAddr("merchant");
    address agent = makeAddr("agent");
    address facilitator = makeAddr("facilitator");
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

    function test_commitQuote_revertIfFacilitatorNotRegistered() public {
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
}
