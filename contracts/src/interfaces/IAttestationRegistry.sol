// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAttestationRegistry {
    struct Attestation {
        address attester;
        bytes32 schema;
        bytes32 subject;
        bytes32 dataHash;
        uint64 timestamp;
        bool revoked;
    }

    event AttestationSubmitted(uint256 indexed id, address indexed attester, bytes32 indexed schema, bytes32 subject);
    event AttestationRevoked(uint256 indexed id);

    error AttestationNotFound();
    error Unauthorized();
    error AlreadyRevoked();

    function submitAttestation(bytes32 schema, bytes32 subject, bytes32 dataHash) external returns (uint256);

    function revokeAttestation(uint256 attestationId) external;

    function getAttestation(uint256 attestationId) external view returns (Attestation memory);

    function getAttestationsBySubject(bytes32 subject) external view returns (uint256[] memory);
}
