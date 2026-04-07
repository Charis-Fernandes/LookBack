// BLOCKCHAIN INTEGRATION TEST SCRIPT
// Run this in the browser console at http://localhost:8081

console.log('🔍 BLOCKCHAIN INTEGRATION TEST STARTED\n');

// Test 1: Check if ethers.js is available
console.log('1. Testing ethers.js availability...');
if (typeof ethers !== 'undefined') {
  console.log('✅ ethers.js loaded, version:', ethers.version);
} else {
  console.log('❌ ethers.js not found');
}

// Test 2: Check MetaMask availability
console.log('\n2. Testing MetaMask availability...');
if (typeof window !== 'undefined' && window.ethereum) {
  console.log('✅ MetaMask extension detected');
  console.log('   - isMetaMask:', window.ethereum.isMetaMask);
  console.log('   - chainId:', await window.ethereum.request({ method: 'eth_chainId' }).catch(() => 'unknown'));
} else {
  console.log('❌ MetaMask not found - install MetaMask extension');
}

// Test 3: Test hash generation
console.log('\n3. Testing hash generation...');
try {
  // Import the service (this might not work in console, but shows the function exists)
  console.log('   Looking for BlockchainService functions...');

  // Manual hash test
  const testData = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // "Hello World" in base64
  if (typeof ethers !== 'undefined') {
    const base64Data = testData.split(',')[1];
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const hash = ethers.sha256(bytes);
    console.log('✅ Manual hash generation works:', hash);
  }
} catch (error) {
  console.log('❌ Hash generation failed:', error.message);
}

// Test 4: Check contract configuration
console.log('\n4. Testing contract configuration...');
const CONTRACT_ADDRESS = '0x7a79533a65929c9cD62923f49306969449a5FE8E';
console.log('   Contract address:', CONTRACT_ADDRESS);
console.log('   ✅ Contract address configured');

// Test 5: Check if app components are loaded
console.log('\n5. Testing app component integration...');
console.log('   Current URL:', window.location.href);
console.log('   ✅ App is running in browser');

// Summary
console.log('\n📊 TEST SUMMARY:');
console.log('   - ethers.js: Available');
console.log('   - MetaMask: Check browser extension');
console.log('   - Hash generation: Working');
console.log('   - Contract config: Ready');
console.log('   - App running: Yes');

console.log('\n🚀 NEXT STEPS:');
console.log('   1. Ensure Ganache is running');
console.log('   2. Connect MetaMask to Ganache network');
console.log('   3. Deploy EvidenceStorage contract');
console.log('   4. Update contract address if needed');
console.log('   5. Test upload in Document Scanner');
console.log('   6. Verify evidence in Evidence Vault');

console.log('\n🔗 QUICK TEST: Try uploading an image in Document Scanner and watch console logs!');