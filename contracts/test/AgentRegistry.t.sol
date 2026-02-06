// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        registry = new AgentRegistry();
    }

    // ── Register ────────────────────────────────────────────────────

    function test_registerAgent() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("ipfs://meta1", hex"aabb", keccak256("caps1"));

        assertEq(id, 1);

        IAgentRegistry.AgentRecord memory agent = registry.getAgent(id);
        assertEq(agent.owner, alice);
        assertEq(agent.metadataURI, "ipfs://meta1");
        assertEq(agent.pubkey, hex"aabb");
        assertEq(agent.capabilitiesHash, keccak256("caps1"));
        assertFalse(agent.revoked);
    }

    function test_registerAgent_incrementingIds() public {
        vm.startPrank(alice);
        uint256 id1 = registry.registerAgent("uri1", "", bytes32(0));
        uint256 id2 = registry.registerAgent("uri2", "", bytes32(0));
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_registerAgent_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit IAgentRegistry.AgentRegistered(1, alice, "ipfs://meta");
        registry.registerAgent("ipfs://meta", "", bytes32(0));
    }

    // ── Update ──────────────────────────────────────────────────────

    function test_updateAgent() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("old", "", bytes32(0));

        bytes32 newCaps = keccak256("new");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IAgentRegistry.AgentUpdated(id, "new-uri", newCaps);
        registry.updateAgent(id, "new-uri", newCaps);

        IAgentRegistry.AgentRecord memory agent = registry.getAgent(id);
        assertEq(agent.metadataURI, "new-uri");
        assertEq(agent.capabilitiesHash, newCaps);
    }

    function test_updateAgent_revertIfNotOwner() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("uri", "", bytes32(0));

        vm.prank(bob);
        vm.expectRevert(IAgentRegistry.Unauthorized.selector);
        registry.updateAgent(id, "new", bytes32(0));
    }

    function test_updateAgent_revertIfRevoked() public {
        vm.startPrank(alice);
        uint256 id = registry.registerAgent("uri", "", bytes32(0));
        registry.revokeAgent(id);

        vm.expectRevert(IAgentRegistry.AgentAlreadyRevoked.selector);
        registry.updateAgent(id, "new", bytes32(0));
        vm.stopPrank();
    }

    // ── Revoke ──────────────────────────────────────────────────────

    function test_revokeAgent() public {
        vm.startPrank(alice);
        uint256 id = registry.registerAgent("uri", "", bytes32(0));

        vm.expectEmit(true, false, false, false);
        emit IAgentRegistry.AgentRevoked(id);
        registry.revokeAgent(id);
        vm.stopPrank();

        IAgentRegistry.AgentRecord memory agent = registry.getAgent(id);
        assertTrue(agent.revoked);
    }

    function test_revokeAgent_revertIfNotOwner() public {
        vm.prank(alice);
        uint256 id = registry.registerAgent("uri", "", bytes32(0));

        vm.prank(bob);
        vm.expectRevert(IAgentRegistry.Unauthorized.selector);
        registry.revokeAgent(id);
    }

    function test_revokeAgent_revertIfAlreadyRevoked() public {
        vm.startPrank(alice);
        uint256 id = registry.registerAgent("uri", "", bytes32(0));
        registry.revokeAgent(id);

        vm.expectRevert(IAgentRegistry.AgentAlreadyRevoked.selector);
        registry.revokeAgent(id);
        vm.stopPrank();
    }

    // ── View ────────────────────────────────────────────────────────

    function test_getAgent_revertIfNotFound() public {
        vm.expectRevert(IAgentRegistry.AgentNotFound.selector);
        registry.getAgent(999);
    }

    function test_getAgentsByOwner() public {
        vm.startPrank(alice);
        registry.registerAgent("a1", "", bytes32(0));
        registry.registerAgent("a2", "", bytes32(0));
        vm.stopPrank();

        vm.prank(bob);
        registry.registerAgent("b1", "", bytes32(0));

        uint256[] memory aliceAgents = registry.getAgentsByOwner(alice);
        assertEq(aliceAgents.length, 2);
        assertEq(aliceAgents[0], 1);
        assertEq(aliceAgents[1], 2);

        uint256[] memory bobAgents = registry.getAgentsByOwner(bob);
        assertEq(bobAgents.length, 1);
        assertEq(bobAgents[0], 3);
    }

    function test_getAgentsByOwner_empty() public view {
        uint256[] memory agents = registry.getAgentsByOwner(alice);
        assertEq(agents.length, 0);
    }
}
