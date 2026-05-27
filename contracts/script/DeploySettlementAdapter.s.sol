// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SettlementAdapter} from "../src/SettlementAdapter.sol";

contract DeploySettlementAdapter is Script {
    function run() external {
        vm.startBroadcast();

        SettlementAdapter settlementAdapter = new SettlementAdapter();
        console.log("SettlementAdapter deployed at:", address(settlementAdapter));

        vm.stopBroadcast();
    }
}
