// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AttestorRegistry {
    struct AttestorRecord {
        address operator;
        string metadataURI;
        bytes32 schemasHash;
        uint256 attestations;
        uint256 revokedAttestations;
        bool active;
    }

    uint256 private _nextAttestorId = 1;

    mapping(uint256 => AttestorRecord) private _attestors;
    mapping(address => uint256) private _attestorByOperator;

    event AttestorRegistered(uint256 indexed attestorId, address indexed operator, string metadataURI, bytes32 schemasHash);
    event AttestorUpdated(uint256 indexed attestorId, string metadataURI, bytes32 schemasHash, bool active);

    error Unauthorized();
    error AttestorNotFound();
    error AttestorAlreadyRegistered();

    function registerAttestor(string calldata metadataURI, bytes32 schemasHash) external returns (uint256 attestorId) {
        if (_attestorByOperator[msg.sender] != 0) revert AttestorAlreadyRegistered();

        attestorId = _nextAttestorId++;
        _attestorByOperator[msg.sender] = attestorId;
        _attestors[attestorId] = AttestorRecord({
            operator: msg.sender,
            metadataURI: metadataURI,
            schemasHash: schemasHash,
            attestations: 0,
            revokedAttestations: 0,
            active: true
        });

        emit AttestorRegistered(attestorId, msg.sender, metadataURI, schemasHash);
    }

    function updateAttestor(uint256 attestorId, string calldata metadataURI, bytes32 schemasHash, bool active) external {
        AttestorRecord storage attestor = _attestors[attestorId];
        if (attestor.operator == address(0)) revert AttestorNotFound();
        if (attestor.operator != msg.sender) revert Unauthorized();

        attestor.metadataURI = metadataURI;
        attestor.schemasHash = schemasHash;
        attestor.active = active;

        emit AttestorUpdated(attestorId, metadataURI, schemasHash, active);
    }

    function getAttestor(uint256 attestorId) external view returns (AttestorRecord memory) {
        AttestorRecord memory attestor = _attestors[attestorId];
        if (attestor.operator == address(0)) revert AttestorNotFound();
        return attestor;
    }

    function getAttestorByOperator(address operator) external view returns (uint256) {
        return _attestorByOperator[operator];
    }
}
