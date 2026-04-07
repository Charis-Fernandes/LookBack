// src/utils/blockchain.js
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./blockchain-config";

// ─── 1. Generate SHA-256 hash of a file (runs in browser) ───────────────────
export async function generateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// ─── 2. Connect to MetaMask + return contract instance ──────────────────────
export async function getContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask.");
  }
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return { contract, signer };
}

// ─── 3. Store evidence hash on blockchain ───────────────────────────────────
export async function storeEvidenceOnChain(evidenceId, fileHash) {
  const { contract } = await getContract();
  const tx = await contract.createEvidence(evidenceId, fileHash);
  await tx.wait(); // Wait for the block to be mined
  console.log("✅ Stored on chain. TX:", tx.hash);
  return tx.hash;
}

// ─── 4. Retrieve evidence record from blockchain ────────────────────────────
export async function getEvidenceFromChain(evidenceId) {
  const { contract } = await getContract();
  const result = await contract.getEvidence(evidenceId);
  return {
    evidenceId: result[0],
    evidenceHash: result[1],
    timestamp: new Date(Number(result[2]) * 1000).toLocaleString(),
    officerAddress: result[3],
  };
}

// ─── 5. Verify file integrity against blockchain ────────────────────────────
export async function verifyEvidenceIntegrity(evidenceId, fileHash) {
  const { contract } = await getContract();
  const isValid = await contract.verifyEvidence(evidenceId, fileHash);
  return isValid;
}