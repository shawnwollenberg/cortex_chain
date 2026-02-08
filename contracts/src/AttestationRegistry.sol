// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";

contract AttestationRegistry is IAttestationRegistry {
    uint256 private _nextAttestationId = 1;

    mapping(uint256 => Attestation) private _attestations;
    mapping(bytes32 => uint256[]) private _subjectAttestations;

    function submitAttestation(bytes32 schema, bytes32 subject, bytes32 dataHash) external returns (uint256) {
        uint256 id = _nextAttestationId++;
        _attestations[id] = Attestation({
            attester: msg.sender,
            schema: schema,
            subject: subject,
            dataHash: dataHash,
            timestamp: uint64(block.timestamp),
            revoked: false
        });
        _subjectAttestations[subject].push(id);
        emit AttestationSubmitted(id, msg.sender, schema, subject);
        return id;
    }

    function revokeAttestation(uint256 attestationId) external {
        Attestation storage att = _attestations[attestationId];
        if (att.attester == address(0)) revert AttestationNotFound();
        if (att.attester != msg.sender) revert Unauthorized();
        if (att.revoked) revert AlreadyRevoked();

        att.revoked = true;
        emit AttestationRevoked(attestationId);
    }

    function getAttestation(uint256 attestationId) external view returns (Attestation memory) {
        Attestation memory att = _attestations[attestationId];
        if (att.attester == address(0)) revert AttestationNotFound();
        return att;
    }

    function getAttestationsBySubject(bytes32 subject) external view returns (uint256[] memory) {
        return _subjectAttestations[subject];
    }
}
