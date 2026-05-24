import type { Abi } from "viem";

export const SolverRegistryABI = [
  {
    type: "event",
    name: "SolverRegistered",
    inputs: [
      { name: "solverId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "operator", type: "address", indexed: true, internalType: "address" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "capabilitiesHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "bond", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SolverUpdated",
    inputs: [
      { name: "solverId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "capabilitiesHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "active", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SolverBondChanged",
    inputs: [
      { name: "solverId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "bond", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const satisfies Abi;
