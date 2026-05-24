// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SolverRegistry {
    struct SolverRecord {
        address operator;
        string metadataURI;
        bytes32 capabilitiesHash;
        uint256 bond;
        uint256 fills;
        uint256 successfulFills;
        uint256 failedFills;
        bool active;
    }

    uint256 private _nextSolverId = 1;

    mapping(uint256 => SolverRecord) private _solvers;
    mapping(address => uint256) private _solverByOperator;

    event SolverRegistered(
        uint256 indexed solverId, address indexed operator, string metadataURI, bytes32 capabilitiesHash, uint256 bond
    );
    event SolverUpdated(uint256 indexed solverId, string metadataURI, bytes32 capabilitiesHash, bool active);
    event SolverBondChanged(uint256 indexed solverId, uint256 bond);

    error Unauthorized();
    error SolverNotFound();
    error SolverAlreadyRegistered();
    error SolverInactive();

    function registerSolver(string calldata metadataURI, bytes32 capabilitiesHash)
        external
        payable
        returns (uint256 solverId)
    {
        if (_solverByOperator[msg.sender] != 0) revert SolverAlreadyRegistered();

        solverId = _nextSolverId++;
        _solverByOperator[msg.sender] = solverId;
        _solvers[solverId] = SolverRecord({
            operator: msg.sender,
            metadataURI: metadataURI,
            capabilitiesHash: capabilitiesHash,
            bond: msg.value,
            fills: 0,
            successfulFills: 0,
            failedFills: 0,
            active: true
        });

        emit SolverRegistered(solverId, msg.sender, metadataURI, capabilitiesHash, msg.value);
    }

    function updateSolver(uint256 solverId, string calldata metadataURI, bytes32 capabilitiesHash, bool active) external {
        SolverRecord storage solver = _solvers[solverId];
        if (solver.operator == address(0)) revert SolverNotFound();
        if (solver.operator != msg.sender) revert Unauthorized();

        solver.metadataURI = metadataURI;
        solver.capabilitiesHash = capabilitiesHash;
        solver.active = active;

        emit SolverUpdated(solverId, metadataURI, capabilitiesHash, active);
    }

    function addBond(uint256 solverId) external payable {
        SolverRecord storage solver = _solvers[solverId];
        if (solver.operator == address(0)) revert SolverNotFound();
        if (solver.operator != msg.sender) revert Unauthorized();

        solver.bond += msg.value;
        emit SolverBondChanged(solverId, solver.bond);
    }

    function withdrawBond(uint256 solverId, uint256 amount) external {
        SolverRecord storage solver = _solvers[solverId];
        if (solver.operator == address(0)) revert SolverNotFound();
        if (solver.operator != msg.sender) revert Unauthorized();
        if (solver.active) revert SolverInactive();

        solver.bond -= amount;
        emit SolverBondChanged(solverId, solver.bond);

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "BOND_WITHDRAW_FAILED");
    }

    function getSolver(uint256 solverId) external view returns (SolverRecord memory) {
        SolverRecord memory solver = _solvers[solverId];
        if (solver.operator == address(0)) revert SolverNotFound();
        return solver;
    }

    function getSolverByOperator(address operator) external view returns (uint256) {
        return _solverByOperator[operator];
    }
}
