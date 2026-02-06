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

struct Intent {
    address owner;
    IntentType intentType;
    Constraints constraints;
    address inputToken;
    address outputToken;
    uint256 nonce;
}

struct Fill {
    uint256 amountIn;
    uint256 amountOut;
    address solver;
    bytes executionData;
}

library IntentTypehashes {
    bytes32 internal constant CONSTRAINTS_TYPEHASH =
        keccak256("Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)");

    bytes32 internal constant INTENT_TYPEHASH = keccak256(
        "Intent(address owner,uint8 intentType,Constraints constraints,address inputToken,address outputToken,uint256 nonce)Constraints(uint256 amountInMax,uint256 amountOutMin,uint256 deadline,uint16 slippageBps)"
    );

    function hashConstraints(Constraints memory c) internal pure returns (bytes32) {
        return keccak256(abi.encode(CONSTRAINTS_TYPEHASH, c.amountInMax, c.amountOutMin, c.deadline, c.slippageBps));
    }

    function hashIntent(Intent memory intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.owner,
                uint8(intent.intentType),
                hashConstraints(intent.constraints),
                intent.inputToken,
                intent.outputToken,
                intent.nonce
            )
        );
    }
}
