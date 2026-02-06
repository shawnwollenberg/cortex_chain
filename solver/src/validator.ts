import {
  type Address,
  type Hex,
  encodeAbiParameters,
  keccak256,
  concat,
  toHex,
  recoverAddress,
} from "viem";
import type { Intent, Constraints } from "./types.js";
import { logger } from "./logger.js";

// Matches IntentTypehashes.sol exactly
const CONSTRAINTS_TYPEHASH = keccak256(
  toHex(
    "Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)",
    { size: undefined },
  ),
);

const INTENT_TYPEHASH = keccak256(
  toHex(
    "Intent(address owner,uint8 intentType,Constraints constraints,address inputToken,address outputToken,uint256 nonce)Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)",
    { size: undefined },
  ),
);

function hashConstraints(c: Constraints): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint16" },
      ],
      [
        CONSTRAINTS_TYPEHASH,
        c.amountInMax,
        c.amountOutMin,
        c.deadline,
        c.slippageBps,
      ],
    ),
  );
}

function hashIntent(intent: Intent): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes32" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        INTENT_TYPEHASH,
        intent.owner,
        intent.intentType,
        hashConstraints(intent.constraints),
        intent.inputToken,
        intent.outputToken,
        intent.nonce,
      ],
    ),
  );
}

function buildDomainSeparator(
  chainId: bigint,
  verifyingContract: Address,
): Hex {
  // EIP-712 domain separator for EIP712("AgentIntentBook", "1")
  const typeHash = keccak256(
    toHex(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
      { size: undefined },
    ),
  );
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        typeHash,
        keccak256(toHex("AgentIntentBook", { size: undefined })),
        keccak256(toHex("1", { size: undefined })),
        chainId,
        verifyingContract,
      ],
    ),
  );
}

export function getDigest(
  intent: Intent,
  chainId: bigint,
  verifyingContract: Address,
): Hex {
  const domainSeparator = buildDomainSeparator(chainId, verifyingContract);
  const structHash = hashIntent(intent);
  return keccak256(concat(["0x1901", domainSeparator, structHash]));
}

export async function verifyIntentSignature(
  intent: Intent,
  signature: Hex,
  chainId: bigint,
  verifyingContract: Address,
): Promise<boolean> {
  const digest = getDigest(intent, chainId, verifyingContract);
  try {
    const recovered = await recoverAddress({ hash: digest, signature });
    if (recovered.toLowerCase() !== intent.owner.toLowerCase()) {
      logger.warn(
        `Signature mismatch: recovered=${recovered}, owner=${intent.owner}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("Signature recovery failed:", err);
    return false;
  }
}

export function validateIntentConstraints(intent: Intent): {
  valid: boolean;
  reason?: string;
} {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (intent.constraints.deadline <= now) {
    return { valid: false, reason: "Intent deadline has passed" };
  }
  if (intent.constraints.slippageBps > 10_000) {
    return { valid: false, reason: "Slippage exceeds 100%" };
  }
  if (intent.constraints.amountInMax <= 0n) {
    return { valid: false, reason: "amountInMax must be > 0" };
  }
  if (intent.constraints.amountOutMin <= 0n) {
    return { valid: false, reason: "amountOutMin must be > 0" };
  }
  return { valid: true };
}
