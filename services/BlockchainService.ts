import { ethers } from 'ethers';

export interface BlockchainEvidenceRecord {
  evidenceId: string;
  evidenceHash: string;
  timestamp: number;
  officerAddress: string;
}

export interface EvidenceVerificationResult {
  blockchainRecord: BlockchainEvidenceRecord;
  freshFileHash: string;
  firebaseFileHash: string;
  blockchainMatchesFreshHash: boolean;
  blockchainMatchesFirebaseHash: boolean;
  firebaseMatchesFreshHash: boolean;
}

// Use environment variable or fallback to Ganache address
const CONTRACT_ADDRESS = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '0x7a79533a65929c9cD62923f49306969449a5FE8E';

const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'evidenceId', type: 'string' },
      { indexed: false, internalType: 'string', name: 'evidenceHash', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'officerAddress', type: 'address' },
    ],
    name: 'EvidenceStored',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'string', name: '_evidenceId', type: 'string' },
      { internalType: 'string', name: '_evidenceHash', type: 'string' },
    ],
    name: 'createEvidence',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: '_evidenceId', type: 'string' }],
    name: 'getEvidence',
    outputs: [
      { internalType: 'string', name: 'evidenceId', type: 'string' },
      { internalType: 'string', name: 'evidenceHash', type: 'string' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'address', name: 'officerAddress', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: '_evidenceId', type: 'string' },
      { internalType: 'string', name: '_hashToVerify', type: 'string' },
    ],
    name: 'verifyEvidence',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const getEthereumProvider = () => {
  // For React Native web
  const maybeWindow = (globalThis as any)?.window;
  if (maybeWindow?.ethereum) {
    return maybeWindow.ethereum;
  }

  // For React Native mobile (would need WalletConnect or similar)
  // This is a placeholder for mobile wallet integration
  throw new Error('Ethereum provider not available. Please use MetaMask on web or configure mobile wallet connection.');
};

const normalizeHash = (hash: string) => hash.trim().toLowerCase().replace(/^0x/, '');

const base64ToBytes = (base64: string) => {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const maybeBuffer = (globalThis as any)?.Buffer;
  if (maybeBuffer) {
    return Uint8Array.from(maybeBuffer.from(base64, 'base64'));
  }

  throw new Error('Base64 decoding is not available in this environment.');
};

const getContract = async (requestAccount = true) => {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error('MetaMask extension not found. Please install MetaMask in your browser.');
  }

  if (requestAccount) {
    await ethereum.request({ method: 'eth_requestAccounts' });
  }

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};

export const hashDataUrl = (dataUrl: string) => {
  const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bytes = base64ToBytes(base64Data);
  return normalizeHash(ethers.sha256(bytes));
};

export const hashFile = async (file: Blob) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return normalizeHash(ethers.sha256(bytes));
};

export const hashImageUrl = async (imageUrl: string) => {
  if (imageUrl.startsWith('data:')) {
    return hashDataUrl(imageUrl);
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for verification (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return normalizeHash(ethers.sha256(bytes));
};

export const createEvidenceOnChain = async (evidenceId: string, fileHash: string) => {
  const contract = await getContract(true);
  const tx = await contract.createEvidence(evidenceId, normalizeHash(fileHash));
  await tx.wait();
  return tx.hash as string;
};

export const getEvidenceFromBlockchain = async (
  evidenceId: string
): Promise<BlockchainEvidenceRecord> => {
  const contract = await getContract(true);
  const result = await contract.getEvidence(evidenceId);
  return {
    evidenceId: result[0],
    evidenceHash: normalizeHash(result[1]),
    timestamp: Number(result[2]),
    officerAddress: result[3],
  };
};

export const verifyEvidenceRecord = async (
  evidenceId: string,
  firebaseFileHash: string | null,
  imageUrl: string
): Promise<EvidenceVerificationResult> => {
  const blockchainRecord = await getEvidenceFromBlockchain(evidenceId);
  const freshFileHash = await hashImageUrl(imageUrl);
  const normalizedBlockchainHash = normalizeHash(blockchainRecord.evidenceHash);
  const normalizedFirebaseHash = firebaseFileHash ? normalizeHash(firebaseFileHash) : '';
  const normalizedFreshHash = normalizeHash(freshFileHash);

  return {
    blockchainRecord,
    freshFileHash: normalizedFreshHash,
    firebaseFileHash: normalizedFirebaseHash,
    blockchainMatchesFreshHash: normalizedBlockchainHash === normalizedFreshHash,
    blockchainMatchesFirebaseHash: firebaseFileHash
      ? normalizedBlockchainHash === normalizedFirebaseHash
      : false,
    firebaseMatchesFreshHash: firebaseFileHash
      ? normalizedFirebaseHash === normalizedFreshHash
      : false,
  };
};

export const blockchainContractConfig = {
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
};
