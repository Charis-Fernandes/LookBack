# 🔍 Blockchain Integration Verification Guide

## ✅ IMPLEMENTATION CHECKLIST

### 1. **SHA-256 Hash Generation** ✅
**Location:** `services/BlockchainService.ts`
```typescript
export const hashDataUrl = (dataUrl: string) => {
  const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bytes = base64ToBytes(base64Data);
  return normalizeHash(ethers.sha256(bytes));
};
```

### 2. **Blockchain Storage Integration** ✅
**Location:** `screens/DocumentScanner.tsx` (lines ~230-250)
```typescript
// ── BLOCKCHAIN INTEGRATION: Store evidence hash on-chain ──
if (evidenceId) {
  try {
    console.log('🔗 Storing evidence on blockchain...');
    const txHash = await createEvidenceOnChain(evidenceId, fileHash);

    // Update Firestore with blockchain data
    await FirebaseService.updateEvidence(evidenceId, {
      fileHash,
      blockchainTxHash: txHash,
      blockchainStored: true,
      blockchainEvidenceId: evidenceId,
    });

    console.log('✅ Evidence secured on blockchain:', txHash);
  } catch (blockchainError) {
    console.warn('⚠️ Blockchain storage failed:', blockchainError);
  }
}
```

### 3. **Firebase Integration** ✅
**Location:** `services/FirebaseService.ts` (EvidenceItem interface)
```typescript
export interface EvidenceItem {
  // ... existing fields
  fileHash?: string;          // SHA-256 hash of the file
  blockchainTxHash?: string;  // Blockchain transaction hash
  blockchainStored?: boolean; // Whether evidence is stored on blockchain
  blockchainEvidenceId?: string;
}
```

### 4. **Verification System** ✅
**Location:** `screens/EvidenceVault.tsx` (handleVerify function)
- Compares blockchain hash with current file hash
- Shows verification status in UI
- Detects tampering and integrity issues

### 5. **Smart Contract** ✅
**Location:** `contracts/EvidenceStorage.sol`
- Functions: createEvidence, getEvidence, verifyEvidence
- Events for audit trails
- Timestamped and officer-addressed records

---

## 🧪 TESTING STEPS

### **Step 1: Prerequisites Check**
```bash
# Check if app is running
curl http://localhost:8081
# Should return HTML content

# Check if ethers.js is installed
npm list ethers
# Should show version ~6.16.0
```

### **Step 2: Browser Console Testing**
1. Open http://localhost:8081
2. Open DevTools (F12) → Console tab
3. Run these commands:

```javascript
// Test hash generation
import { hashDataUrl } from './services/BlockchainService';
const testData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
console.log('Hash:', hashDataUrl(testData));
// Should output a 64-character hex string starting with '0x'
```

### **Step 3: MetaMask Setup Verification**
1. Open MetaMask extension
2. Check network: Should be "Ganache" or "Localhost 8545"
3. Check account: Should have ETH balance
4. Console test:
```javascript
// Check if MetaMask is available
console.log('MetaMask available:', !!window.ethereum);
// Should output: MetaMask available: true
```

### **Step 4: Full Upload Test**
1. Go to **Document Scanner** screen
2. Upload an image (gallery or camera)
3. Watch browser console for logs:
   - `🔗 Storing evidence on blockchain...`
   - MetaMask transaction popup should appear
   - `✅ Evidence secured on blockchain: 0x...`

### **Step 5: Verification Test**
1. Go to **Evidence Vault** screen
2. Click on an uploaded evidence item
3. Click **"🔍 Verify Integrity"** button
4. Watch console for:
   - `🔍 Verifying evidence integrity: ...`
   - Verification results should appear

### **Step 6: Firebase Data Check**
1. Open Firebase Console
2. Go to Firestore Database
3. Check evidence documents for:
   - `fileHash`: SHA-256 hash
   - `blockchainTxHash`: Transaction hash
   - `blockchainStored`: true
   - `blockchainEvidenceId`: Evidence ID

---

## 🔧 TROUBLESHOOTING

### **Issue: "MetaMask not found"**
```
Solution: Install MetaMask extension and refresh the page
```

### **Issue: "Contract not deployed"**
```bash
# Deploy contract to Ganache
# 1. Start Ganache
# 2. Deploy contracts/EvidenceStorage.sol
# 3. Update CONTRACT_ADDRESS in BlockchainService.ts
```

### **Issue: "Transaction failed"**
```
Check:
1. MetaMask connected to correct network
2. Account has ETH balance
3. Contract address is correct
4. Contract ABI matches deployed contract
```

### **Issue: "Hash mismatch"**
```
Check:
1. Image data URL format is correct
2. Hash function is using the right data
3. Compare with manual hash generation
```

---

## 📊 EXPECTED RESULTS

### **Console Logs (Successful Upload):**
```
📸 Scanning document from ESP32-CAM...
💾 Saving document to Evidence Vault...
☁️ Saving evidence to Firestore...
🔗 Storing evidence on blockchain...
✅ Evidence secured on blockchain: 0x1234567890abcdef...
🤖 [Background] Running AI pipeline...
```

### **Verification Results:**
- ✅ **Verified** - All hashes match
- ❌ **TAMPERED** - Image has been modified
- ⚠️ **Warning** - Firebase hash differs from current image

### **UI Indicators:**
- Evidence cards show "On-chain" badge
- Modal shows blockchain transaction hash
- Verification button shows status

---

## 🎯 QUICK VERIFICATION SCRIPT

Run this in browser console to test core functions:

```javascript
// Test 1: Import check
console.log('1. Testing imports...');
try {
  const { hashDataUrl, createEvidenceOnChain } = await import('./services/BlockchainService');
  console.log('✅ Imports working');
} catch(e) {
  console.log('❌ Import failed:', e);
}

// Test 2: Hash generation
console.log('2. Testing hash generation...');
const testData = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
const hash = hashDataUrl(testData);
console.log('✅ Hash generated:', hash);

// Test 3: MetaMask check
console.log('3. Testing MetaMask...');
console.log('MetaMask available:', !!window.ethereum);

// Test 4: Contract connection (requires MetaMask approval)
console.log('4. Testing contract connection...');
if (window.ethereum) {
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    console.log('✅ MetaMask connected');
  } catch(e) {
    console.log('❌ MetaMask connection failed:', e);
  }
}
```

**Run this script in the browser console at http://localhost:8081 to verify everything is working!** 🚀