// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {SignerECDSA} from "@openzeppelin/contracts/utils/cryptography/signers/SignerECDSA.sol";
import {IPolicyModule} from "./interfaces/IPolicyModule.sol";

contract PolicyAccount is Account, SignerECDSA {
    IPolicyModule public immutable policyModule;

    error ExecutionFailed(bytes returnData);

    constructor(address signerAddr, IPolicyModule policyModule_) SignerECDSA(signerAddr) {
        policyModule = policyModule_;
    }

    // ── Execution ────────────────────────────────────────────────────

    function execute(address target, uint256 value, bytes calldata data)
        external
        onlyEntryPointOrSelf
        returns (bytes memory)
    {
        // 1. Check policy (reverts if violated)
        policyModule.checkTransaction(target, value, data);

        // 2. Record ETH spend before external call (checks-effects-interactions)
        if (value > 0) {
            policyModule.recordSpend(address(0), value);
        }

        // 3. Execute the call
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed(result);
        }

        return result;
    }

    // ── Policy configuration (convenience wrappers) ──────────────────

    function setSpendLimit(address token, uint256 maxPerDay) external onlyEntryPointOrSelf {
        policyModule.setSpendLimit(token, maxPerDay);
    }

    function setTargetAllowed(address target, bool allowed) external onlyEntryPointOrSelf {
        policyModule.setTargetAllowed(target, allowed);
    }

    function setFunctionAllowed(address target, bytes4 selector, bool allowed) external onlyEntryPointOrSelf {
        policyModule.setFunctionAllowed(target, selector, allowed);
    }

    function setUseFunctionAllowlist(bool enabled) external onlyEntryPointOrSelf {
        policyModule.setUseFunctionAllowlist(enabled);
    }
}
