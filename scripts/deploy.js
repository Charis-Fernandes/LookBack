import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

async function main() {
  console.log("Deploying EvidenceStorage contract...");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/EvidenceStorage.sol/EvidenceStorage.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
  const privateKey = '0x61fff5cf6675aa85e45df1ad220c4754e418a6a4ce19e54ed349112f550da285';
  if (!privateKey) {
    throw new Error(
      "Set GANACHE_PRIVATE_KEY to the private key of one of your Ganache accounts before deploying."
    );
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const evidenceStorage = await factory.deploy();

  await evidenceStorage.waitForDeployment();

  const address = await evidenceStorage.getAddress();
  console.log("EvidenceStorage deployed to:", address);

  // Save the address to a file for easy reference
  fs.writeFileSync("contract-address.txt", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });