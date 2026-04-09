/** @type import('hardhat/config').HardhatUserConfig */
const ganachePrivateKey = process.env.GANACHE_PRIVATE_KEY || '';
const ganacheRpcUrl = process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545';

if (!ganachePrivateKey) {
  console.warn(
    '[hardhat] GANACHE_PRIVATE_KEY is not set. Set it to a Ganache account private key before deploying.'
  );
}

const config = {
  solidity: "0.8.19",
  networks: {
    ganache: {
      type: "http",
      url: ganacheRpcUrl,
      accounts: ganachePrivateKey ? [ganachePrivateKey] : []
    }
  }
};

export default config;