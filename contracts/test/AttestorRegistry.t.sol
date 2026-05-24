// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestorRegistry} from "../src/AttestorRegistry.sol";

contract AttestorRegistryTest is Test {
    AttestorRegistry public registry;

    address public attestor = makeAddr("attestor");

    function setUp() public {
        registry = new AttestorRegistry();
    }

    function test_registerAttestor() public {
        vm.prank(attestor);
        uint256 attestorId = registry.registerAttestor("ipfs://attestor", keccak256("schemas"));

        assertEq(attestorId, 1);
        assertEq(registry.getAttestorByOperator(attestor), 1);

        AttestorRegistry.AttestorRecord memory record = registry.getAttestor(attestorId);
        assertEq(record.operator, attestor);
        assertEq(record.metadataURI, "ipfs://attestor");
        assertEq(record.schemasHash, keccak256("schemas"));
        assertTrue(record.active);
    }

    function test_registerAttestor_revertDuplicateOperator() public {
        vm.startPrank(attestor);
        registry.registerAttestor("ipfs://attestor", keccak256("schemas"));

        vm.expectRevert(AttestorRegistry.AttestorAlreadyRegistered.selector);
        registry.registerAttestor("ipfs://attestor2", keccak256("schemas2"));
        vm.stopPrank();
    }

    function test_updateAttestor_ownerOnly() public {
        vm.prank(attestor);
        uint256 attestorId = registry.registerAttestor("ipfs://attestor", keccak256("schemas"));

        vm.prank(makeAddr("other"));
        vm.expectRevert(AttestorRegistry.Unauthorized.selector);
        registry.updateAttestor(attestorId, "ipfs://bad", bytes32(0), false);

        vm.prank(attestor);
        registry.updateAttestor(attestorId, "ipfs://new", keccak256("newSchemas"), false);

        AttestorRegistry.AttestorRecord memory record = registry.getAttestor(attestorId);
        assertEq(record.metadataURI, "ipfs://new");
        assertEq(record.schemasHash, keccak256("newSchemas"));
        assertFalse(record.active);
    }
}
