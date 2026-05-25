import type pg from "pg";
import type { Log } from "viem";
import { decodeEventLog } from "viem";
import { CommerceRegistryABI } from "../abi/CommerceRegistry.js";
import { logger } from "../logger.js";

const DISPUTE_STATUS = ["OPEN", "RESOLVED", "REJECTED"] as const;

export async function handleCommerceRegistryLog(pool: pg.Pool, log: Log): Promise<void> {
  const decoded = decodeEventLog({
    abi: CommerceRegistryABI,
    data: log.data,
    topics: log.topics,
  });

  switch (decoded.eventName) {
    case "MerchantRegistered": {
      const { merchantId, owner, payoutAddress, metadataURI, metadataHash } = decoded.args;
      await pool.query(
        `INSERT INTO merchants (merchant_id, owner, payout_address, metadata_uri, metadata_hash, block_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (merchant_id) DO UPDATE SET
          owner = $2, payout_address = $3, metadata_uri = $4, metadata_hash = $5,
          active = true, block_number = $6, updated_at = now()`,
        [merchantId.toString(), owner.toLowerCase(), payoutAddress.toLowerCase(), metadataURI, metadataHash, Number(log.blockNumber)],
      );
      logger.info(`Indexed MerchantRegistered: merchantId=${merchantId}`);
      break;
    }
    case "MerchantUpdated": {
      const { merchantId, payoutAddress, metadataURI, metadataHash, active } = decoded.args;
      await pool.query(
        `UPDATE merchants SET payout_address = $1, metadata_uri = $2, metadata_hash = $3,
          active = $4, block_number = $5, updated_at = now()
         WHERE merchant_id = $6`,
        [payoutAddress.toLowerCase(), metadataURI, metadataHash, active, Number(log.blockNumber), merchantId.toString()],
      );
      break;
    }
    case "ServiceRegistered": {
      const { serviceNumericId, merchantId, serviceId, metadataURI, metadataHash, capabilityHash } = decoded.args;
      await pool.query(
        `INSERT INTO services
          (service_numeric_id, merchant_id, service_id, metadata_uri, metadata_hash, capability_hash, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (service_numeric_id) DO UPDATE SET
          merchant_id = $2, service_id = $3, metadata_uri = $4, metadata_hash = $5,
          capability_hash = $6, active = true, block_number = $7, updated_at = now()`,
        [serviceNumericId.toString(), merchantId.toString(), serviceId, metadataURI, metadataHash, capabilityHash, Number(log.blockNumber)],
      );
      logger.info(`Indexed ServiceRegistered: serviceNumericId=${serviceNumericId}`);
      break;
    }
    case "ServiceUpdated": {
      const { serviceNumericId, metadataURI, metadataHash, capabilityHash, active } = decoded.args;
      await pool.query(
        `UPDATE services SET metadata_uri = $1, metadata_hash = $2, capability_hash = $3,
          active = $4, block_number = $5, updated_at = now()
         WHERE service_numeric_id = $6`,
        [metadataURI, metadataHash, capabilityHash, active, Number(log.blockNumber), serviceNumericId.toString()],
      );
      break;
    }
    case "FacilitatorRegistered": {
      const { facilitatorId, facilitator, metadataURI, metadataHash } = decoded.args;
      await pool.query(
        `INSERT INTO facilitators (facilitator_id, facilitator, metadata_uri, metadata_hash, block_number)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (facilitator_id) DO UPDATE SET
          facilitator = $2, metadata_uri = $3, metadata_hash = $4,
          active = true, block_number = $5, updated_at = now()`,
        [facilitatorId.toString(), facilitator.toLowerCase(), metadataURI, metadataHash, Number(log.blockNumber)],
      );
      logger.info(`Indexed FacilitatorRegistered: facilitatorId=${facilitatorId}`);
      break;
    }
    case "FacilitatorUpdated": {
      const { facilitatorId, facilitator, metadataURI, metadataHash, active } = decoded.args;
      await pool.query(
        `UPDATE facilitators SET facilitator = $1, metadata_uri = $2, metadata_hash = $3,
          active = $4, block_number = $5, updated_at = now()
         WHERE facilitator_id = $6`,
        [facilitator.toLowerCase(), metadataURI, metadataHash, active, Number(log.blockNumber), facilitatorId.toString()],
      );
      break;
    }
    case "QuoteCommitted": {
      const {
        quoteHash,
        merchantId,
        serviceNumericId,
        agent,
        token,
        facilitator,
        amount,
        paymentRail,
        protocolFeeBps,
        protocolFeeAmount,
        expiresAt,
        paymentNonce,
        resourceHash,
        termsHash,
        x402PayloadHash,
      } = decoded.args;
      await pool.query(
        `INSERT INTO quotes
          (quote_hash, merchant_id, service_numeric_id, agent, token, facilitator, amount, expires_at,
           payment_nonce, resource_hash, terms_hash, x402_payload_hash, payment_rail, protocol_fee_bps,
           protocol_fee_amount, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (quote_hash) DO UPDATE SET
          merchant_id = $2, service_numeric_id = $3, agent = $4, token = $5, facilitator = $6,
          amount = $7, expires_at = $8, payment_nonce = $9, resource_hash = $10, terms_hash = $11,
          x402_payload_hash = $12, payment_rail = $13, protocol_fee_bps = $14,
          protocol_fee_amount = $15, block_number = $16, updated_at = now()`,
        [
          quoteHash,
          merchantId.toString(),
          serviceNumericId.toString(),
          agent.toLowerCase(),
          token.toLowerCase(),
          facilitator.toLowerCase(),
          amount.toString(),
          expiresAt.toString(),
          paymentNonce.toString(),
          resourceHash,
          termsHash,
          x402PayloadHash,
          Number(paymentRail),
          protocolFeeBps,
          protocolFeeAmount.toString(),
          Number(log.blockNumber),
        ],
      );
      logger.info(`Indexed QuoteCommitted: quoteHash=${quoteHash}`);
      break;
    }
    case "ReceiptRecorded": {
      const {
        receiptId,
        quoteHash,
        agent,
        merchantId,
        serviceNumericId,
        token,
        amount,
        paymentRail,
        protocolFeeBps,
        protocolFeeAmount,
        facilitator,
        resultHash,
        resourceHash,
        fulfillmentHash,
      } = decoded.args;
      await pool.query(
        `INSERT INTO commerce_receipts
          (receipt_id, quote_hash, agent, merchant_id, service_numeric_id, token, amount, facilitator,
           result_hash, resource_hash, fulfillment_hash, payment_rail, protocol_fee_bps, protocol_fee_amount,
           block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (receipt_id) DO UPDATE SET
          quote_hash = $2, agent = $3, merchant_id = $4, service_numeric_id = $5, token = $6,
          amount = $7, facilitator = $8, result_hash = $9, resource_hash = $10,
          fulfillment_hash = $11, payment_rail = $12, protocol_fee_bps = $13,
          protocol_fee_amount = $14, block_number = $15`,
        [
          receiptId.toString(),
          quoteHash,
          agent.toLowerCase(),
          merchantId.toString(),
          serviceNumericId.toString(),
          token.toLowerCase(),
          amount.toString(),
          facilitator.toLowerCase(),
          resultHash,
          resourceHash,
          fulfillmentHash,
          Number(paymentRail),
          protocolFeeBps,
          protocolFeeAmount.toString(),
          Number(log.blockNumber),
        ],
      );
      await pool.query("UPDATE quotes SET settled = true, updated_at = now() WHERE quote_hash = $1", [quoteHash]);
      logger.info(`Indexed ReceiptRecorded: receiptId=${receiptId}`);
      break;
    }
    case "FulfillmentRecorded": {
      const { receiptId, fulfillmentHash } = decoded.args;
      await pool.query(
        `UPDATE commerce_receipts SET fulfillment_hash = $1, block_number = $2 WHERE receipt_id = $3`,
        [fulfillmentHash, Number(log.blockNumber), receiptId.toString()],
      );
      logger.info(`Indexed FulfillmentRecorded: receiptId=${receiptId}`);
      break;
    }
    case "TrustSignalRecorded": {
      const { signalId, subjectType, subjectId, kind, reporter, signalHash } = decoded.args;
      await pool.query(
        `INSERT INTO trust_signals
          (signal_id, subject_type, subject_id, kind, reporter, signal_hash, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (signal_id) DO UPDATE SET
          subject_type = $2, subject_id = $3, kind = $4, reporter = $5, signal_hash = $6,
          block_number = $7`,
        [
          signalId.toString(),
          Number(subjectType),
          subjectId.toString(),
          Number(kind),
          reporter.toLowerCase(),
          signalHash,
          Number(log.blockNumber),
        ],
      );
      logger.info(`Indexed TrustSignalRecorded: signalId=${signalId}`);
      break;
    }
    case "DisputeOpened": {
      const { disputeId, receiptId, opener, reasonHash } = decoded.args;
      await pool.query(
        `INSERT INTO disputes (dispute_id, receipt_id, opener, reason_hash, block_number)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dispute_id) DO UPDATE SET
          receipt_id = $2, opener = $3, reason_hash = $4, status = 'OPEN',
          block_number = $5, updated_at = now()`,
        [disputeId.toString(), receiptId.toString(), opener.toLowerCase(), reasonHash, Number(log.blockNumber)],
      );
      logger.info(`Indexed DisputeOpened: disputeId=${disputeId}`);
      break;
    }
    case "DisputeResolved": {
      const { disputeId, status, resolutionHash } = decoded.args;
      await pool.query(
        `UPDATE disputes SET status = $1, resolution_hash = $2, block_number = $3, updated_at = now()
         WHERE dispute_id = $4`,
        [DISPUTE_STATUS[status] ?? "OPEN", resolutionHash, Number(log.blockNumber), disputeId.toString()],
      );
      logger.info(`Indexed DisputeResolved: disputeId=${disputeId}`);
      break;
    }
  }
}
