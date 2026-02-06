// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";

contract AgentRegistry is IAgentRegistry {
    uint256 private _nextAgentId = 1;

    mapping(uint256 => AgentRecord) private _agents;
    mapping(address => uint256[]) private _ownerAgents;

    function registerAgent(string calldata metadataURI, bytes calldata pubkey, bytes32 capabilitiesHash)
        external
        returns (uint256 agentId)
    {
        agentId = _nextAgentId++;
        _agents[agentId] = AgentRecord({
            owner: msg.sender,
            metadataURI: metadataURI,
            pubkey: pubkey,
            capabilitiesHash: capabilitiesHash,
            revoked: false
        });
        _ownerAgents[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    function updateAgent(uint256 agentId, string calldata metadataURI, bytes32 capabilitiesHash) external {
        AgentRecord storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound();
        if (agent.owner != msg.sender) revert Unauthorized();
        if (agent.revoked) revert AgentAlreadyRevoked();

        agent.metadataURI = metadataURI;
        agent.capabilitiesHash = capabilitiesHash;
        emit AgentUpdated(agentId, metadataURI, capabilitiesHash);
    }

    function revokeAgent(uint256 agentId) external {
        AgentRecord storage agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound();
        if (agent.owner != msg.sender) revert Unauthorized();
        if (agent.revoked) revert AgentAlreadyRevoked();

        agent.revoked = true;
        emit AgentRevoked(agentId);
    }

    function getAgent(uint256 agentId) external view returns (AgentRecord memory) {
        AgentRecord memory agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound();
        return agent;
    }

    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }
}
