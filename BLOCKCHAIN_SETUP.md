# Blockchain Setup Guide for LookBack

## Prerequisites

1. **Ganache** - Local Ethereum blockchain for development
   - Download from: https://trufflesuite.com/ganache/
   - Install and start Ganache

2. **MetaMask** - Browser wallet for blockchain interaction
   - Install MetaMask extension in your browser
   - Create or import an account

## Step 1: Deploy Smart Contract to Ganache

1. Start Ganache (it runs on http://127.0.0.1:8545 by default)

2. Copy the contract from `contracts/EvidenceStorage.sol`

3. In Ganache, click "Contracts" tab → "New Contract"

4. Paste the contract code and deploy it

5. Copy the deployed contract address

## Step 2: Configure MetaMask for Ganache

1. Open MetaMask extension

2. Click the network dropdown (usually "Ethereum Mainnet")

3. Click "Add Network"

4. Enter these details:
   - **Network Name**: Ganache
   - **New RPC URL**: http://127.0.0.1:8545
   - **Chain ID**: 1337 (default Ganache chain ID)
   - **Currency Symbol**: ETH

5. Switch to the "Ganache" network

6. Import Ganache accounts to MetaMask:
   - In Ganache, go to "Accounts" tab
   - Copy private key of Account 0
   - In MetaMask: Click account icon → "Import Account" → Paste private key

## Step 3: Update Contract Address in App

Update the contract address in your app:

1. Open `services/BlockchainService.ts`
2. Replace the `CONTRACT_ADDRESS` with your deployed contract address
3. Or set environment variable: `BLOCKCHAIN_CONTRACT_ADDRESS=0x...`

## Step 4: Test the Integration

1. Run the LookBack app
2. Upload an image in Document Scanner
3. Check browser console for blockchain transaction logs
4. Verify evidence in Evidence Vault

## Troubleshooting

### MetaMask Connection Issues
- Ensure Ganache is running
- Check that MetaMask is connected to Ganache network
- Try refreshing the app

### Contract Deployment Issues
- Ensure contract code is valid Solidity
- Check Ganache is running on port 8545
- Verify gas limit in deployment

### Transaction Failures
- Ensure you have ETH in your MetaMask account (Ganache provides free ETH)
- Check contract address is correct
- Verify ABI matches deployed contract

## Contract Functions

The EvidenceStorage contract provides:

- `createEvidence(string _evidenceId, string _evidenceHash)` - Store evidence hash
- `getEvidence(string _evidenceId)` - Retrieve evidence record
- `verifyEvidence(string _evidenceId, string _hashToVerify)` - Verify hash integrity

All evidence is timestamped and linked to the officer's address for audit trails.