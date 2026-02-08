import type { Abi } from "viem";

export const AttestationRegistryABI = [
  {
    type: "function",
    name: "getAttestation",
    inputs: [
      { name: "attestationId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IAttestationRegistry.Attestation",
        components: [
          { name: "attester", type: "address", internalType: "address" },
          { name: "schema", type: "bytes32", internalType: "bytes32" },
          { name: "subject", type: "bytes32", internalType: "bytes32" },
          { name: "dataHash", type: "bytes32", internalType: "bytes32" },
          { name: "timestamp", type: "uint64", internalType: "uint64" },
          { name: "revoked", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestationsBySubject",
    inputs: [
      { name: "subject", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "submitAttestation",
    inputs: [
      { name: "schema", type: "bytes32", internalType: "bytes32" },
      { name: "subject", type: "bytes32", internalType: "bytes32" },
      { name: "dataHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAttestation",
    inputs: [
      { name: "attestationId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AttestationSubmitted",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "attester", type: "address", indexed: true, internalType: "address" },
      { name: "schema", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "subject", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AttestationRevoked",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyRevoked", inputs: [] },
  { type: "error", name: "AttestationNotFound", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const satisfies Abi;
