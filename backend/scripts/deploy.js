const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy CarbonCreditRegistry
  console.log("📋 Deploying CarbonCreditRegistry...");
  const CarbonCreditRegistry = await hre.ethers.getContractFactory("CarbonCreditRegistry");
  const registry = await CarbonCreditRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ CarbonCreditRegistry deployed to:", registryAddress, "\n");

  // Deploy CarbonCreditToken
  console.log("🪙 Deploying CarbonCreditToken...");
  const CarbonCreditToken = await hre.ethers.getContractFactory("CarbonCreditToken");
  const token = await CarbonCreditToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ CarbonCreditToken deployed to:", tokenAddress, "\n");

  // Deploy CarbonMarketplace
  console.log("🏪 Deploying CarbonMarketplace...");
  const CarbonMarketplace = await hre.ethers.getContractFactory("CarbonMarketplace");
  const marketplace = await CarbonMarketplace.deploy(tokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ CarbonMarketplace deployed to:", marketplaceAddress, "\n");

  // Deploy CarbonCreditNFT
  console.log("🎫 Deploying CarbonCreditNFT...");
  const CarbonCreditNFT = await hre.ethers.getContractFactory("CarbonCreditNFT");
  const nft = await CarbonCreditNFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ CarbonCreditNFT deployed to:", nftAddress, "\n");

  // Grant roles
  console.log("🔐 Setting up roles...");
  const MINTER_ROLE = await token.MINTER_ROLE();
  await token.grantRole(MINTER_ROLE, marketplaceAddress);
  await nft.grantRole(MINTER_ROLE, deployer.address);
  console.log("✅ Roles configured\n");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CarbonCreditRegistry: registryAddress,
      CarbonCreditToken: tokenAddress,
      CarbonMarketplace: marketplaceAddress,
      CarbonCreditNFT: nftAddress
    }
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filePath = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 Deployment info saved to:", filePath);
  console.log("\n✨ Deployment completed successfully! ✨\n");
  console.log("📋 Contract Addresses:");
  console.log("─────────────────────────────────────────────");
  console.log("Registry:     ", registryAddress);
  console.log("Token:        ", tokenAddress);
  console.log("Marketplace:  ", marketplaceAddress);
  console.log("NFT:          ", nftAddress);
  console.log("─────────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
