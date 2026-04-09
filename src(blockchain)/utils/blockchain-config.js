// src/utils/blockchain-config.js

export const CONTRACT_ADDRESS = "0x403c6a137E3bbFd27A9deDBF01b43290B8b222B4";

export const CONTRACT_ABI = [
  
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "evidenceId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "evidenceHash",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "officerAddress",
				"type": "address"
			}
		],
		"name": "EvidenceStored",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_evidenceId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_evidenceHash",
				"type": "string"
			}
		],
		"name": "createEvidence",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_evidenceId",
				"type": "string"
			}
		],
		"name": "getEvidence",
		"outputs": [
			{
				"internalType": "string",
				"name": "evidenceId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "evidenceHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "officerAddress",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_evidenceId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_hashToVerify",
				"type": "string"
			}
		],
		"name": "verifyEvidence",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}

];
