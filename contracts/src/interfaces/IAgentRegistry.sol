// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentRegistry {
    struct AgentRecord {
        address owner;
        string metadataURI;
        bytes pubkey;
        bytes32 capabilitiesHash;
        bool revoked;
    }

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event AgentUpdated(uint256 indexed agentId, string metadataURI, bytes32 capabilitiesHash);
    event AgentRevoked(uint256 indexed agentId);

    error Unauthorized();
    error AgentNotFound();
    error AgentAlreadyRevoked();

    function registerAgent(string calldata metadataURI, bytes calldata pubkey, bytes32 capabilitiesHash)
        external
        returns (uint256 agentId);

    function updateAgent(uint256 agentId, string calldata metadataURI, bytes32 capabilitiesHash) external;

    function revokeAgent(uint256 agentId) external;

    function getAgent(uint256 agentId) external view returns (AgentRecord memory);

    function getAgentsByOwner(address owner) external view returns (uint256[] memory);
}
