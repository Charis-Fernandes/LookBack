// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EvidenceStorage {
    struct EvidenceRecord {
        string evidenceId;
        string evidenceHash;
        uint256 timestamp;
        address officerAddress;
    }

    mapping(string => EvidenceRecord) public evidenceRecords;
    mapping(string => bool) public evidenceExists;

    event EvidenceStored(
        string evidenceId,
        string evidenceHash,
        uint256 timestamp,
        address officerAddress
    );

    function createEvidence(string memory _evidenceId, string memory _evidenceHash) public {
        require(!evidenceExists[_evidenceId], "Evidence already exists");

        evidenceRecords[_evidenceId] = EvidenceRecord({
            evidenceId: _evidenceId,
            evidenceHash: _evidenceHash,
            timestamp: block.timestamp,
            officerAddress: msg.sender
        });

        evidenceExists[_evidenceId] = true;

        emit EvidenceStored(_evidenceId, _evidenceHash, block.timestamp, msg.sender);
    }

    function getEvidence(string memory _evidenceId) public view returns (
        string memory,
        string memory,
        uint256,
        address
    ) {
        require(evidenceExists[_evidenceId], "Evidence does not exist");

        EvidenceRecord memory record = evidenceRecords[_evidenceId];
        return (
            record.evidenceId,
            record.evidenceHash,
            record.timestamp,
            record.officerAddress
        );
    }

    function verifyEvidence(string memory _evidenceId, string memory _hashToVerify) public view returns (bool) {
        if (!evidenceExists[_evidenceId]) {
            return false;
        }

        EvidenceRecord memory record = evidenceRecords[_evidenceId];
        return keccak256(abi.encodePacked(record.evidenceHash)) == keccak256(abi.encodePacked(_hashToVerify));
    }
}