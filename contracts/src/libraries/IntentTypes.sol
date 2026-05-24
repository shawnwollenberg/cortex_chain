// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum IntentStatus {
    OPEN,
    FILLED,
    CANCELLED,
    EXPIRED
}

enum IntentType {
    SWAP_EXACT_IN_MAX_SLIPPAGE
}

struct Constraints {
    uint256 amountInMax;
    uint256 amountOutMin;
    uint256 deadline;
    uint16 slippageBps;
}

struct ExecutionRequirements {
    address target;
    bytes32 dataHash;
    bytes32 requiredAttestationSubject;
    bytes32 requiredAttestationSchema;
    bytes32 metadataURIHash;
}

struct Intent {
    address owner;
    IntentType intentType;
    Constraints constraints;
    ExecutionRequirements execution;
    address inputToken;
    address outputToken;
    uint256 nonce;
}

struct Fill {
    uint256 amountIn;
    uint256 amountOut;
    address solver;
    bytes executionData;
    bytes32 resultHash;
    bytes32 traceHash;
    uint256 attestationId;
}

struct SolverBid {
    address solver;
    uint256 amountIn;
    uint256 amountOut;
    uint256 fee;
    uint256 validUntil;
    bytes32 executionHash;
    bool selected;
    bool exists;
}

library IntentTypehashes {
    bytes32 internal constant CONSTRAINTS_TYPEHASH =
        keccak256("Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)");

    bytes32 internal constant EXECUTION_REQUIREMENTS_TYPEHASH = keccak256(
        "ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"
    );

    bytes32 internal constant INTENT_TYPEHASH = keccak256(
        "Intent(address owner,uint8 intentType,Constraints constraints,ExecutionRequirements execution,address inputToken,address outputToken,uint256 nonce)Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)ExecutionRequirements(address target,bytes32 dataHash,bytes32 requiredAttestationSubject,bytes32 requiredAttestationSchema,bytes32 metadataURIHash)"
    );

    function hashConstraints(Constraints memory c) internal pure returns (bytes32) {
        return keccak256(abi.encode(CONSTRAINTS_TYPEHASH, c.amountInMax, c.amountOutMin, c.deadline, c.slippageBps));
    }

    function hashExecutionRequirements(ExecutionRequirements memory e) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EXECUTION_REQUIREMENTS_TYPEHASH,
                e.target,
                e.dataHash,
                e.requiredAttestationSubject,
                e.requiredAttestationSchema,
                e.metadataURIHash
            )
        );
    }

    function hashIntent(Intent memory intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.owner,
                uint8(intent.intentType),
                hashConstraints(intent.constraints),
                hashExecutionRequirements(intent.execution),
                intent.inputToken,
                intent.outputToken,
                intent.nonce
            )
        );
    }
}
