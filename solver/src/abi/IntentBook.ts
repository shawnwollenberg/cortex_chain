import type { Abi } from "viem";

export const IntentBookABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelIntent",
    inputs: [
      { name: "intentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1", internalType: "bytes1" },
      { name: "name", type: "string", internalType: "string" },
      { name: "version", type: "string", internalType: "string" },
      { name: "chainId", type: "uint256", internalType: "uint256" },
      { name: "verifyingContract", type: "address", internalType: "address" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "extensions", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "fillIntent",
    inputs: [
      { name: "intentId", type: "uint256", internalType: "uint256" },
      {
        name: "fill",
        type: "tuple",
        internalType: "struct Fill",
        components: [
          { name: "amountIn", type: "uint256", internalType: "uint256" },
          { name: "amountOut", type: "uint256", internalType: "uint256" },
          { name: "solver", type: "address", internalType: "address" },
          { name: "executionData", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIntent",
    inputs: [
      { name: "intentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Intent",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "intentType", type: "uint8", internalType: "enum IntentType" },
          {
            name: "constraints",
            type: "tuple",
            internalType: "struct Constraints",
            components: [
              { name: "amountInMax", type: "uint256", internalType: "uint256" },
              { name: "amountOutMin", type: "uint256", internalType: "uint256" },
              { name: "deadline", type: "uint256", internalType: "uint256" },
              { name: "slippageBps", type: "uint16", internalType: "uint16" },
            ],
          },
          { name: "inputToken", type: "address", internalType: "address" },
          { name: "outputToken", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getIntentStatus",
    inputs: [
      { name: "intentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint8", internalType: "enum IntentStatus" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "submitIntent",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        internalType: "struct Intent",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "intentType", type: "uint8", internalType: "enum IntentType" },
          {
            name: "constraints",
            type: "tuple",
            internalType: "struct Constraints",
            components: [
              { name: "amountInMax", type: "uint256", internalType: "uint256" },
              { name: "amountOutMin", type: "uint256", internalType: "uint256" },
              { name: "deadline", type: "uint256", internalType: "uint256" },
              { name: "slippageBps", type: "uint16", internalType: "uint16" },
            ],
          },
          { name: "inputToken", type: "address", internalType: "address" },
          { name: "outputToken", type: "address", internalType: "address" },
          { name: "nonce", type: "uint256", internalType: "uint256" },
        ],
      },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "intentId", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "EIP712DomainChanged",
    inputs: [],
    anonymous: false,
  },
  {
    type: "event",
    name: "IntentCancelled",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "IntentFilled",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "solver", type: "address", indexed: true, internalType: "address" },
      { name: "amountIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "amountOut", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "IntentSubmitted",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "nonce", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  { type: "error", name: "ConstraintViolation", inputs: [] },
  { type: "error", name: "ECDSAInvalidSignature", inputs: [] },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [{ name: "length", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [{ name: "s", type: "bytes32", internalType: "bytes32" }],
  },
  { type: "error", name: "IntentExpired", inputs: [] },
  { type: "error", name: "IntentNotOpen", inputs: [] },
  { type: "error", name: "InvalidDeadline", inputs: [] },
  { type: "error", name: "InvalidNonce", inputs: [] },
  { type: "error", name: "InvalidShortString", inputs: [] },
  { type: "error", name: "InvalidSignature", inputs: [] },
  { type: "error", name: "InvalidSlippage", inputs: [] },
  {
    type: "error",
    name: "StringTooLong",
    inputs: [{ name: "str", type: "string", internalType: "string" }],
  },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const satisfies Abi;
