// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";

contract SolverRegistryTest is Test {
    SolverRegistry public registry;

    address public solver = makeAddr("solver");

    function setUp() public {
        registry = new SolverRegistry();
        vm.deal(solver, 10 ether);
    }

    function test_registerSolver() public {
        vm.prank(solver);
        uint256 solverId = registry.registerSolver{value: 1 ether}("ipfs://solver", keccak256("swap"));

        assertEq(solverId, 1);
        assertEq(registry.getSolverByOperator(solver), 1);

        SolverRegistry.SolverRecord memory record = registry.getSolver(solverId);
        assertEq(record.operator, solver);
        assertEq(record.metadataURI, "ipfs://solver");
        assertEq(record.capabilitiesHash, keccak256("swap"));
        assertEq(record.bond, 1 ether);
        assertTrue(record.active);
    }

    function test_registerSolver_revertDuplicateOperator() public {
        vm.startPrank(solver);
        registry.registerSolver("ipfs://solver", keccak256("swap"));

        vm.expectRevert(SolverRegistry.SolverAlreadyRegistered.selector);
        registry.registerSolver("ipfs://solver2", keccak256("swap2"));
        vm.stopPrank();
    }

    function test_updateSolver_ownerOnly() public {
        vm.prank(solver);
        uint256 solverId = registry.registerSolver("ipfs://solver", keccak256("swap"));

        vm.prank(makeAddr("other"));
        vm.expectRevert(SolverRegistry.Unauthorized.selector);
        registry.updateSolver(solverId, "ipfs://bad", bytes32(0), false);

        vm.prank(solver);
        registry.updateSolver(solverId, "ipfs://new", keccak256("commerce"), false);

        SolverRegistry.SolverRecord memory record = registry.getSolver(solverId);
        assertEq(record.metadataURI, "ipfs://new");
        assertEq(record.capabilitiesHash, keccak256("commerce"));
        assertFalse(record.active);
    }

}
