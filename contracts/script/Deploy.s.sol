// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IntentBook} from "../src/IntentBook.sol";
import {PolicyModule} from "../src/PolicyModule.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(registry));

        IntentBook intentBook = new IntentBook();
        console.log("IntentBook deployed at:", address(intentBook));

        PolicyModule policyModule = new PolicyModule();
        console.log("PolicyModule deployed at:", address(policyModule));

        AttestationRegistry attestationRegistry = new AttestationRegistry();
        console.log("AttestationRegistry deployed at:", address(attestationRegistry));

        vm.stopBroadcast();
    }
}
