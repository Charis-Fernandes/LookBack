const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying EvidenceStorage contract...");

  const EvidenceStorage = await ethers.getContractFactory("EvidenceStorage");
  const evidenceStorage = await EvidenceStorage.deploy();

  await evidenceStorage.waitForDeployment();

  const address = await evidenceStorage.getAddress();
  console.log("EvidenceStorage deployed to:", address);

  // Save the address to a file for easy reference
  const fs = require("fs");
  fs.writeFileSync("contract-address.txt", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });