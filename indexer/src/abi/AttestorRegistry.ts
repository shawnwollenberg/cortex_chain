import type { Abi } from "viem";

export const AttestorRegistryABI = [
  {
    type: "event",
    name: "AttestorRegistered",
    inputs: [
      { name: "attestorId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "operator", type: "address", indexed: true, internalType: "address" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "schemasHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AttestorUpdated",
    inputs: [
      { name: "attestorId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "metadataURI", type: "string", indexed: false, internalType: "string" },
      { name: "schemasHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "active", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
] as const satisfies Abi;
