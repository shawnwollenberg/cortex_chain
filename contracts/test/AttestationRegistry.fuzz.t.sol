// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {IAttestationRegistry} from "../src/interfaces/IAttestationRegistry.sol";

contract AttestationRegistryFuzzTest is Test {
    AttestationRegistry public registry;

    function setUp() public {
        registry = new AttestationRegistry();
    }

    // ── Arbitrary data ────────────────────────────────────────────

    function testFuzz_submitAttestation_arbitraryData(
        address caller,
        bytes32 schema,
        bytes32 subject,
        bytes32 dataHash
    ) public {
        vm.assume(caller != address(0));

        vm.prank(caller);
        uint256 id = registry.submitAttestation(schema, subject, dataHash);

        assertEq(id, 1);

        IAttestationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.attester, caller);
        assertEq(att.schema, schema);
        assertEq(att.subject, subject);
        assertEq(att.dataHash, dataHash);
        assertFalse(att.revoked);
    }

    // ── Sequential IDs ────────────────────────────────────────────

    function testFuzz_sequentialIds(uint8 count) public {
        count = uint8(bound(count, 1, 50));

        address caller = makeAddr("attester");
        vm.startPrank(caller);
        for (uint256 i = 1; i <= count; i++) {
            uint256 id = registry.submitAttestation(bytes32(i), bytes32(0), bytes32(0));
            assertEq(id, i);
        }
        vm.stopPrank();
    }

    // ── Access control: revoke ────────────────────────────────────

    function testFuzz_revokeAttestation_revertIfNotAttester(address attacker) public {
        address attester = makeAddr("attester");
        vm.assume(attacker != attester);
        vm.assume(attacker != address(0));

        vm.prank(attester);
        uint256 id = registry.submitAttestation(bytes32(0), bytes32(0), bytes32(0));

        vm.prank(attacker);
        vm.expectRevert(IAttestationRegistry.Unauthorized.selector);
        registry.revokeAttestation(id);
    }

    // ── Subject isolation ─────────────────────────────────────────

    function testFuzz_subjectIsolation(bytes32 subjectA, bytes32 subjectB) public {
        vm.assume(subjectA != subjectB);

        address caller = makeAddr("attester");
        vm.startPrank(caller);
        registry.submitAttestation(bytes32(0), subjectA, bytes32(0));
        registry.submitAttestation(bytes32(0), subjectB, bytes32(0));
        vm.stopPrank();

        uint256[] memory aIds = registry.getAttestationsBySubject(subjectA);
        uint256[] memory bIds = registry.getAttestationsBySubject(subjectB);

        assertEq(aIds.length, 1);
        assertEq(bIds.length, 1);
        assertEq(aIds[0], 1);
        assertEq(bIds[0], 2);
    }

    // ── Revoke + double revoke ────────────────────────────────────

    function testFuzz_doubleRevoke_reverts(bytes32 schema, bytes32 subject, bytes32 dataHash) public {
        address attester = makeAddr("attester");

        vm.startPrank(attester);
        uint256 id = registry.submitAttestation(schema, subject, dataHash);
        registry.revokeAttestation(id);

        vm.expectRevert(IAttestationRegistry.AlreadyRevoked.selector);
        registry.revokeAttestation(id);
        vm.stopPrank();
    }
}
