import type { Abi } from "viem";

export const AgentRegistryABI = [
  {
    type: "function",
    name: "getAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IAgentRegistry.AgentRecord",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "metadataURI", type: "string", internalType: "string" },
          { name: "pubkey", type: "bytes", internalType: "bytes" },
          { name: "capabilitiesHash", type: "bytes32", internalType: "bytes32" },
          { name: "revoked", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentsByOwner",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "uint256[]", internalType: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "metadataURI", type: "string", internalType: "string" },
      { name: "pubkey", type: "bytes", internalType: "bytes" },
      { name: "capabilitiesHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateAgent",
    inputs: [
      { name: "agentId", type: "uint256", internalType: "uint256" },
      { name: "metadataURI", type: "string", internalType: "string" },
      { name: "capabilitiesHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AgentRevoked",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AgentUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "capabilitiesHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  { type: "error", name: "AgentAlreadyRevoked", inputs: [] },
  { type: "error", name: "AgentNotFound", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const satisfies Abi;
