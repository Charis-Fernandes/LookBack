/** @type import('hardhat/config').HardhatUserConfig */
const ganachePrivateKey = '0x61fff5cf6675aa85e45df1ad220c4754e418a6a4ce19e54ed349112f550da285';

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
      url: "http://127.0.0.1:7545",
      accounts: ganachePrivateKey ? [ganachePrivateKey] : []
    }
  }
};

export default config;