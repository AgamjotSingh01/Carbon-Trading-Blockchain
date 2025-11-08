const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CarbonTradingPlatform", (m) => {
  // Deploy CarbonCreditRegistry
  const registry = m.contract("CarbonCreditRegistry");

  // Deploy CarbonCreditToken
  const token = m.contract("CarbonCreditToken");

  // Deploy CarbonMarketplace with token address
  const marketplace = m.contract("CarbonMarketplace", [token]);

  // Deploy CarbonCreditNFT
  const nft = m.contract("CarbonCreditNFT");

  // Get the deployer account
  const deployer = m.getAccount(0);

  // Grant MINTER_ROLE on token to marketplace
  const MINTER_ROLE = m.staticCall(token, "MINTER_ROLE");
  m.call(token, "grantRole", [MINTER_ROLE, marketplace]);

  // Grant MINTER_ROLE on NFT to deployer (for certificate minting)
  const NFT_MINTER_ROLE = m.staticCall(nft, "MINTER_ROLE");
  m.call(nft, "grantRole", [NFT_MINTER_ROLE, deployer]);

  return {
    registry,
    token,
    marketplace,
    nft,
  };
});
