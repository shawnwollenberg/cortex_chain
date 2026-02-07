// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

contract AgentRegistryFuzzTest is Test {
    AgentRegistry public registry;

    function setUp() public {
        registry = new AgentRegistry();
    }

    // ── Registration with arbitrary data ─────────────────────────────

    function testFuzz_registerAgent_arbitraryData(
        address caller,
        string calldata metadataURI,
        bytes calldata pubkey,
        bytes32 capabilitiesHash
    ) public {
        vm.assume(caller != address(0));

        vm.prank(caller);
        uint256 agentId = registry.registerAgent(metadataURI, pubkey, capabilitiesHash);

        assertEq(agentId, 1);

        IAgentRegistry.AgentRecord memory agent = registry.getAgent(agentId);
        assertEq(agent.owner, caller);
        assertEq(agent.metadataURI, metadataURI);
        assertEq(agent.pubkey, pubkey);
        assertEq(agent.capabilitiesHash, capabilitiesHash);
        assertFalse(agent.revoked);
    }

    // ── Sequential IDs ───────────────────────────────────────────────

    function testFuzz_sequentialIds(uint8 count) public {
        count = uint8(bound(count, 1, 50));

        address caller = makeAddr("registrar");
        vm.startPrank(caller);
        for (uint256 i = 1; i <= count; i++) {
            uint256 id = registry.registerAgent("", "", bytes32(i));
            assertEq(id, i);
        }
        vm.stopPrank();

        uint256[] memory owned = registry.getAgentsByOwner(caller);
        assertEq(owned.length, count);
    }

    // ── Access control: update ───────────────────────────────────────

    function testFuzz_updateAgent_revertIfNotOwner(address attacker) public {
        address owner = makeAddr("owner");
        vm.assume(attacker != owner);
        vm.assume(attacker != address(0));

        vm.prank(owner);
        uint256 agentId = registry.registerAgent("uri", "", bytes32(0));

        vm.prank(attacker);
        vm.expectRevert(IAgentRegistry.Unauthorized.selector);
        registry.updateAgent(agentId, "hacked", bytes32(0));
    }

    // ── Access control: revoke ───────────────────────────────────────

    function testFuzz_revokeAgent_revertIfNotOwner(address attacker) public {
        address owner = makeAddr("owner");
        vm.assume(attacker != owner);
        vm.assume(attacker != address(0));

        vm.prank(owner);
        uint256 agentId = registry.registerAgent("uri", "", bytes32(0));

        vm.prank(attacker);
        vm.expectRevert(IAgentRegistry.Unauthorized.selector);
        registry.revokeAgent(agentId);
    }

    // ── Revoke blocks update ─────────────────────────────────────────

    function testFuzz_revokedAgent_cannotUpdate(string calldata newURI, bytes32 newCaps) public {
        address owner = makeAddr("owner");

        vm.startPrank(owner);
        uint256 agentId = registry.registerAgent("uri", "", bytes32(0));
        registry.revokeAgent(agentId);

        vm.expectRevert(IAgentRegistry.AgentAlreadyRevoked.selector);
        registry.updateAgent(agentId, newURI, newCaps);
        vm.stopPrank();
    }

    // ── Multiple owners isolation ────────────────────────────────────

    function testFuzz_ownerIsolation(address ownerA, address ownerB) public {
        vm.assume(ownerA != ownerB);
        vm.assume(ownerA != address(0));
        vm.assume(ownerB != address(0));

        vm.prank(ownerA);
        uint256 idA = registry.registerAgent("a", "", bytes32(0));

        vm.prank(ownerB);
        uint256 idB = registry.registerAgent("b", "", bytes32(0));

        uint256[] memory aAgents = registry.getAgentsByOwner(ownerA);
        uint256[] memory bAgents = registry.getAgentsByOwner(ownerB);

        assertEq(aAgents.length, 1);
        assertEq(bAgents.length, 1);
        assertEq(aAgents[0], idA);
        assertEq(bAgents[0], idB);

        // ownerA can't touch ownerB's agent
        vm.prank(ownerA);
        vm.expectRevert(IAgentRegistry.Unauthorized.selector);
        registry.updateAgent(idB, "hacked", bytes32(0));
    }
}
