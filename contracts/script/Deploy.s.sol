// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IntentBook} from "../src/IntentBook.sol";
import {PolicyModule} from "../src/PolicyModule.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";
import {AttestorRegistry} from "../src/AttestorRegistry.sol";
import {CommerceRegistry} from "../src/CommerceRegistry.sol";
import {SettlementAdapter} from "../src/SettlementAdapter.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(registry));

        PolicyModule policyModule = new PolicyModule();
        console.log("PolicyModule deployed at:", address(policyModule));

        AttestationRegistry attestationRegistry = new AttestationRegistry();
        console.log("AttestationRegistry deployed at:", address(attestationRegistry));

        IntentBook intentBook = new IntentBook(address(attestationRegistry));
        console.log("IntentBook deployed at:", address(intentBook));

        SolverRegistry solverRegistry = new SolverRegistry();
        console.log("SolverRegistry deployed at:", address(solverRegistry));

        AttestorRegistry attestorRegistry = new AttestorRegistry();
        console.log("AttestorRegistry deployed at:", address(attestorRegistry));

        CommerceRegistry commerceRegistry = new CommerceRegistry();
        console.log("CommerceRegistry deployed at:", address(commerceRegistry));

        SettlementAdapter settlementAdapter = new SettlementAdapter();
        console.log("SettlementAdapter deployed at:", address(settlementAdapter));

        vm.stopBroadcast();
    }
}
