import { hashDataUrl, createEvidenceOnChain, getEvidenceFromBlockchain, verifyEvidenceRecord } from './services/BlockchainService';

// Test data - replace with actual image data URL
const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function testBlockchainIntegration() {
  try {
    console.log('🧪 Testing Blockchain Integration...\n');

    // 1. Generate hash
    console.log('1. Generating SHA-256 hash...');
    const fileHash = hashDataUrl(testImageDataUrl);
    console.log('✅ Hash generated:', fileHash);

    // 2. Create evidence ID
    const evidenceId = `test-evidence-${Date.now()}`;
    console.log('2. Evidence ID:', evidenceId);

    // 3. Store on blockchain (requires MetaMask connection)
    console.log('3. Storing evidence on blockchain...');
    console.log('   📝 Please approve the transaction in MetaMask...');
    const txHash = await createEvidenceOnChain(evidenceId, fileHash);
    console.log('✅ Evidence stored. Transaction:', txHash);

    // 4. Retrieve from blockchain
    console.log('4. Retrieving evidence from blockchain...');
    const blockchainRecord = await getEvidenceFromBlockchain(evidenceId);
    console.log('✅ Retrieved record:', blockchainRecord);

    // 5. Verify integrity
    console.log('5. Verifying evidence integrity...');
    const verification = await verifyEvidenceRecord(evidenceId, fileHash, testImageDataUrl);
    console.log('✅ Verification result:', verification);

    console.log('\n🎉 All tests passed! Blockchain integration is working.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure Ganache is running');
    console.log('2. Ensure MetaMask is connected to Ganache network');
    console.log('3. Ensure contract is deployed and address is correct');
    console.log('4. Ensure you have ETH in your MetaMask account');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testBlockchainIntegration();
}

export { testBlockchainIntegration };