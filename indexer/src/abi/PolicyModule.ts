import type { Abi } from "viem";

export const PolicyModuleABI = [
  {
    type: "function",
    name: "checkTransaction",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSpendLimit",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IPolicyModule.SpendLimit",
        components: [
          { name: "maxPerDay", type: "uint256", internalType: "uint256" },
          { name: "spentToday", type: "uint256", internalType: "uint256" },
          { name: "lastResetTimestamp", type: "uint48", internalType: "uint48" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSpentToday",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isFunctionAllowed",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "target", type: "address", internalType: "address" },
      { name: "selector", type: "bytes4", internalType: "bytes4" },
    ],
    outputs: [
      { name: "", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isTargetAllowed",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "target", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "recordSpend",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFunctionAllowed",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "selector", type: "bytes4", internalType: "bytes4" },
      { name: "allowed", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setSpendLimit",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "maxPerDay", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTargetAllowed",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "allowed", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setUseFunctionAllowlist",
    inputs: [
      { name: "enabled", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "FunctionAllowlistUpdated",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "target", type: "address", indexed: true, internalType: "address" },
      { name: "selector", type: "bytes4", indexed: false, internalType: "bytes4" },
      { name: "allowed", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SpendLimitSet",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "maxPerDay", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SpendRecorded",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "dailyTotal", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TargetAllowlistUpdated",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "target", type: "address", indexed: true, internalType: "address" },
      { name: "allowed", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "DailySpendLimitExceeded",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "attempted", type: "uint256", internalType: "uint256" },
      { name: "remaining", type: "uint256", internalType: "uint256" },
    ],
  },
  { type: "error", name: "DelegateCallNotAllowed", inputs: [] },
  {
    type: "error",
    name: "FunctionNotAllowed",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
      { name: "selector", type: "bytes4", internalType: "bytes4" },
    ],
  },
  {
    type: "error",
    name: "TargetNotAllowed",
    inputs: [
      { name: "target", type: "address", internalType: "address" },
    ],
  },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const satisfies Abi;
