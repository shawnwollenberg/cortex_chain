// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {IAttestationRegistry} from "../src/interfaces/IAttestationRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public constant PRICE_QUOTE = keccak256("PriceQuote");
    bytes32 public constant SIM_RESULT = keccak256("SimulationResult");

    function setUp() public {
        registry = new AttestationRegistry();
    }

    // ── Submit ────────────────────────────────────────────────────

    function test_submitAttestation() public {
        bytes32 subject = bytes32(uint256(1));
        bytes32 dataHash = keccak256("data");

        vm.prank(alice);
        uint256 id = registry.submitAttestation(PRICE_QUOTE, subject, dataHash);

        assertEq(id, 1);

        IAttestationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.attester, alice);
        assertEq(att.schema, PRICE_QUOTE);
        assertEq(att.subject, subject);
        assertEq(att.dataHash, dataHash);
        assertEq(att.timestamp, block.timestamp);
        assertFalse(att.revoked);
    }

    function test_submitAttestation_incrementingIds() public {
        vm.startPrank(alice);
        uint256 id1 = registry.submitAttestation(PRICE_QUOTE, bytes32(0), bytes32(0));
        uint256 id2 = registry.submitAttestation(PRICE_QUOTE, bytes32(0), bytes32(0));
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_submitAttestation_emitsEvent() public {
        bytes32 subject = bytes32(uint256(42));

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit IAttestationRegistry.AttestationSubmitted(1, alice, PRICE_QUOTE, subject);
        registry.submitAttestation(PRICE_QUOTE, subject, bytes32(0));
    }

    // ── Revoke ────────────────────────────────────────────────────

    function test_revokeAttestation() public {
        vm.startPrank(alice);
        uint256 id = registry.submitAttestation(PRICE_QUOTE, bytes32(0), bytes32(0));

        vm.expectEmit(true, false, false, false);
        emit IAttestationRegistry.AttestationRevoked(id);
        registry.revokeAttestation(id);
        vm.stopPrank();

        IAttestationRegistry.Attestation memory att = registry.getAttestation(id);
        assertTrue(att.revoked);
    }

    function test_revokeAttestation_revertIfNotAttester() public {
        vm.prank(alice);
        uint256 id = registry.submitAttestation(PRICE_QUOTE, bytes32(0), bytes32(0));

        vm.prank(bob);
        vm.expectRevert(IAttestationRegistry.Unauthorized.selector);
        registry.revokeAttestation(id);
    }

    function test_revokeAttestation_revertIfAlreadyRevoked() public {
        vm.startPrank(alice);
        uint256 id = registry.submitAttestation(PRICE_QUOTE, bytes32(0), bytes32(0));
        registry.revokeAttestation(id);

        vm.expectRevert(IAttestationRegistry.AlreadyRevoked.selector);
        registry.revokeAttestation(id);
        vm.stopPrank();
    }

    function test_revokeAttestation_revertIfNotFound() public {
        vm.prank(alice);
        vm.expectRevert(IAttestationRegistry.AttestationNotFound.selector);
        registry.revokeAttestation(999);
    }

    // ── View ──────────────────────────────────────────────────────

    function test_getAttestation_revertIfNotFound() public {
        vm.expectRevert(IAttestationRegistry.AttestationNotFound.selector);
        registry.getAttestation(999);
    }

    function test_getAttestationsBySubject() public {
        bytes32 subject = bytes32(uint256(1));

        vm.startPrank(alice);
        registry.submitAttestation(PRICE_QUOTE, subject, bytes32(0));
        registry.submitAttestation(SIM_RESULT, subject, bytes32(0));
        vm.stopPrank();

        // Different subject
        vm.prank(bob);
        registry.submitAttestation(PRICE_QUOTE, bytes32(uint256(2)), bytes32(0));

        uint256[] memory ids = registry.getAttestationsBySubject(subject);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_getAttestationsBySubject_empty() public view {
        uint256[] memory ids = registry.getAttestationsBySubject(bytes32(uint256(99)));
        assertEq(ids.length, 0);
    }
}
