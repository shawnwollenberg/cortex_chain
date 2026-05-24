// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {SignerECDSA} from "@openzeppelin/contracts/utils/cryptography/signers/SignerECDSA.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IPolicyModule} from "./interfaces/IPolicyModule.sol";

contract PolicyAccount is Account, SignerECDSA {
    IPolicyModule public immutable policyModule;

    struct SessionKey {
        uint48 expiresAt;
        bool active;
    }

    mapping(address => SessionKey) public sessionKeys;
    mapping(address => mapping(uint256 => bool)) public usedSessionNonces;

    error ExecutionFailed(bytes returnData);
    error InvalidSessionKey();
    error SessionKeyExpired();
    error SessionNonceUsed();

    event SessionKeyUpdated(address indexed sessionKey, uint48 expiresAt, bool active);
    event SessionKeyExecuted(address indexed sessionKey, address indexed target, uint256 value, uint256 nonce);

    modifier onlyEntryPointSelfOrSigner() {
        address sender = msg.sender;
        if (sender != address(this) && sender != address(entryPoint()) && sender != signer()) {
            revert AccountUnauthorized(sender);
        }
        _;
    }

    constructor(address signerAddr, IPolicyModule policyModule_) SignerECDSA(signerAddr) {
        policyModule = policyModule_;
    }

    // ── Execution ────────────────────────────────────────────────────

    function execute(address target, uint256 value, bytes calldata data)
        external
        onlyEntryPointSelfOrSigner
        returns (bytes memory)
    {
        return _executePolicyChecked(target, value, data);
    }

    function executeWithSessionKey(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external returns (bytes memory) {
        if (block.timestamp > deadline) revert SessionKeyExpired();

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(address(this), block.chainid, target, value, keccak256(data), deadline, nonce))
        );
        address sessionSigner = ECDSA.recover(digest, signature);

        SessionKey memory sessionKey = sessionKeys[sessionSigner];
        if (!sessionKey.active) revert InvalidSessionKey();
        if (sessionKey.expiresAt < block.timestamp) revert SessionKeyExpired();
        if (usedSessionNonces[sessionSigner][nonce]) revert SessionNonceUsed();

        usedSessionNonces[sessionSigner][nonce] = true;

        bytes memory result = _executePolicyChecked(target, value, data);
        emit SessionKeyExecuted(sessionSigner, target, value, nonce);
        return result;
    }

    // ── Policy configuration (convenience wrappers) ──────────────────

    function setSpendLimit(address token, uint256 maxPerDay) external onlyEntryPointSelfOrSigner {
        policyModule.setSpendLimit(token, maxPerDay);
    }

    function setTargetAllowed(address target, bool allowed) external onlyEntryPointSelfOrSigner {
        policyModule.setTargetAllowed(target, allowed);
    }

    function setFunctionAllowed(address target, bytes4 selector, bool allowed) external onlyEntryPointSelfOrSigner {
        policyModule.setFunctionAllowed(target, selector, allowed);
    }

    function setUseFunctionAllowlist(bool enabled) external onlyEntryPointSelfOrSigner {
        policyModule.setUseFunctionAllowlist(enabled);
    }

    function setSessionKey(address sessionKey, uint48 expiresAt, bool active) external onlyEntryPointSelfOrSigner {
        sessionKeys[sessionKey] = SessionKey({expiresAt: expiresAt, active: active});
        emit SessionKeyUpdated(sessionKey, expiresAt, active);
    }

    function setGuardian(address guardian) external onlyEntryPointSelfOrSigner {
        policyModule.setGuardian(guardian);
    }

    function setAccountFrozen(bool frozen) external onlyEntryPointSelfOrSigner {
        policyModule.setAccountFrozen(address(this), frozen);
    }

    function _executePolicyChecked(address target, uint256 value, bytes calldata data) internal returns (bytes memory) {
        // 1. Check policy (reverts if violated)
        policyModule.checkTransaction(target, value, data);

        // 2. Record spend before external call (checks-effects-interactions)
        if (value > 0) {
            policyModule.recordSpend(address(0), value);
        }
        (address token, uint256 tokenAmount) = policyModule.getTokenSpend(target, data);
        if (tokenAmount > 0) {
            policyModule.recordSpend(token, tokenAmount);
        }

        // 3. Execute the call
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed(result);
        }

        return result;
    }
}
