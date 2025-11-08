const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper function to format numbers
function formatToken(value) {
  return hre.ethers.formatUnits(value, 18);
}

function parseToken(value) {
  return hre.ethers.parseUnits(value.toString(), 18);
}

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log("\n🔗 Carbon Trading Platform - Contract Interaction\n", colors.bright);

  // Load deployment addresses
  const deploymentsPath = path.join(__dirname, "../deployments", `${hre.network.name}.json`);
  
  if (!fs.existsSync(deploymentsPath)) {
    log("❌ Deployment file not found. Please deploy contracts first.", colors.red);
    log(`Expected file: ${deploymentsPath}`, colors.yellow);
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const [signer, addr1, addr2] = await hre.ethers.getSigners();

  log(`📍 Network: ${hre.network.name}`, colors.cyan);
  log(`👤 Account: ${signer.address}`, colors.cyan);
  log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address))} ETH\n`, colors.cyan);

  // Get contract instances
  const token = await hre.ethers.getContractAt(
    "CarbonCreditToken",
    deployment.contracts.CarbonCreditToken
  );
  
  const marketplace = await hre.ethers.getContractAt(
    "CarbonMarketplace",
    deployment.contracts.CarbonMarketplace
  );

  const registry = await hre.ethers.getContractAt(
    "CarbonCreditRegistry",
    deployment.contracts.CarbonCreditRegistry
  );

  const nft = await hre.ethers.getContractAt(
    "CarbonCreditNFT",
    deployment.contracts.CarbonCreditNFT
  );

  log("📋 Contract Addresses:", colors.bright);
  log("─────────────────────────────────────────────");
  log(`Token:        ${deployment.contracts.CarbonCreditToken}`);
  log(`Marketplace:  ${deployment.contracts.CarbonMarketplace}`);
  log(`Registry:     ${deployment.contracts.CarbonCreditRegistry}`);
  log(`NFT:          ${deployment.contracts.CarbonCreditNFT}`);
  log("─────────────────────────────────────────────\n");

  // ============================================
  // 1. REGISTER ISSUER
  // ============================================
  log("📝 Step 1: Registering Issuer...", colors.yellow);
  try {
    const isRegistered = await registry.isRegisteredIssuer(signer.address);
    
    if (!isRegistered) {
      const registerTx = await registry.registerIssuer("Green Energy Corporation");
      await registerTx.wait();
      log("✅ Issuer registered successfully", colors.green);
    } else {
      log("ℹ️  Already registered as issuer", colors.blue);
    }

    const issuerData = await registry.issuers(signer.address);
    log(`   Name: ${issuerData.name}`);
    log(`   Verified: ${issuerData.isVerified}`);
    log(`   Projects: ${issuerData.projectsRegistered.toString()}\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 2. REGISTER CARBON PROJECT
  // ============================================
  log("🌳 Step 2: Registering Carbon Project...", colors.yellow);
  try {
    const projectTx = await registry.registerProject(
      "Amazon Rainforest Conservation",
      "Forestry",
      "Brazil, Amazon Basin",
      "ipfs://QmXxxx...project-metadata"
    );
    const receipt = await projectTx.wait();
    
    // Get project ID from event
    const projectId = await registry.nextProjectId() - 1n;
    log("✅ Project registered successfully", colors.green);
    log(`   Project ID: ${projectId.toString()}`);
    
    const project = await registry.getProject(projectId);
    log(`   Name: ${project.name}`);
    log(`   Type: ${project.projectType}`);
    log(`   Location: ${project.location}\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 3. MINT CARBON CREDITS
  // ============================================
  log("🪙 Step 3: Minting Carbon Credits...", colors.yellow);
  try {
    const mintAmount = parseToken("5000");
    const currentTime = Math.floor(Date.now() / 1000);
    const vintage = currentTime - (365 * 24 * 60 * 60); // 1 year ago

    const mintTx = await token.mintCredits(
      signer.address,
      mintAmount,
      "Amazon Rainforest Conservation",
      "Forestry",
      "Brazil",
      vintage
    );
    const mintReceipt = await mintTx.wait();
    
    log("✅ Carbon credits minted successfully", colors.green);
    log(`   Amount: ${formatToken(mintAmount)} CCT`);
    log(`   Gas Used: ${mintReceipt.gasUsed.toString()}\n`);

    // Check balance
    const balance = await token.balanceOf(signer.address);
    log(`💰 Your CCT Balance: ${formatToken(balance)} CCT\n`, colors.cyan);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 4. GET CREDIT METADATA
  // ============================================
  log("📊 Step 4: Fetching Credit Metadata...", colors.yellow);
  try {
    const creditId = 0;
    const metadata = await token.getCreditMetadata(creditId);
    
    log("✅ Credit metadata retrieved", colors.green);
    log(`   Project: ${metadata.projectName}`);
    log(`   Type: ${metadata.projectType}`);
    log(`   Location: ${metadata.location}`);
    log(`   Vintage: ${new Date(Number(metadata.vintage) * 1000).toLocaleDateString()}`);
    log(`   Retired: ${metadata.isRetired}\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 5. CREATE MARKETPLACE LISTING
  // ============================================
  log("🏪 Step 5: Creating Marketplace Listing...", colors.yellow);
  try {
    const listingAmount = parseToken("2000");
    const pricePerCredit = hre.ethers.parseEther("0.001"); // 0.001 ETH per credit

    // Approve marketplace to spend tokens
    log("   Approving marketplace...");
    const approveTx = await token.approve(
      deployment.contracts.CarbonMarketplace,
      listingAmount
    );
    await approveTx.wait();
    log("   ✓ Approval confirmed", colors.green);

    // Create listing
    const listingTx = await marketplace.createListing(
      listingAmount,
      pricePerCredit,
      0, // credit ID
      "Amazon Rainforest Conservation"
    );
    await listingTx.wait();
    
    const listingId = await marketplace.nextListingId() - 1n;
    log("✅ Listing created successfully", colors.green);
    log(`   Listing ID: ${listingId.toString()}`);
    log(`   Amount: ${formatToken(listingAmount)} CCT`);
    log(`   Price: ${hre.ethers.formatEther(pricePerCredit)} ETH per credit`);
    log(`   Total Value: ${hre.ethers.formatEther(listingAmount * pricePerCredit / parseToken("1"))} ETH\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 6. GET ACTIVE LISTINGS
  // ============================================
  log("📋 Step 6: Fetching Active Listings...", colors.yellow);
  try {
    const activeListings = await marketplace.getActiveListings();
    
    log(`✅ Found ${activeListings.length} active listing(s)`, colors.green);
    
    activeListings.forEach((listing, index) => {
      log(`\n   Listing #${index}:`);
      log(`   ├─ Seller: ${listing.seller}`);
      log(`   ├─ Amount: ${formatToken(listing.amount)} CCT`);
      log(`   ├─ Price: ${hre.ethers.formatEther(listing.pricePerCredit)} ETH/credit`);
      log(`   ├─ Project: ${listing.projectName}`);
      log(`   └─ Active: ${listing.isActive}`);
    });
    console.log();
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 7. GET MARKETPLACE STATISTICS
  // ============================================
  log("📊 Step 7: Marketplace Statistics...", colors.yellow);
  try {
    const stats = await marketplace.getMarketplaceStats();
    
    log("✅ Marketplace stats retrieved", colors.green);
    log(`   Total Listings: ${stats[0].toString()}`);
    log(`   Total Volume: ${hre.ethers.formatEther(stats[1])} ETH`);
    log(`   Total Trades: ${stats[2].toString()}`);
    log(`   Platform Fee: ${(Number(stats[3]) / 100).toFixed(2)}%\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 8. SIMULATE BUYING CREDITS (if additional account available)
  // ============================================
  if (addr1) {
    log("🛒 Step 8: Simulating Credit Purchase...", colors.yellow);
    try {
      const buyAmount = parseToken("500");
      const listingId = 0;
      
      const listing = await marketplace.listings(listingId);
      const totalPrice = (buyAmount * listing.pricePerCredit) / parseToken("1");
      
      log(`   Buyer: ${addr1.address}`);
      log(`   Amount: ${formatToken(buyAmount)} CCT`);
      log(`   Total Cost: ${hre.ethers.formatEther(totalPrice)} ETH`);
      
      // Check if addr1 has enough ETH
      const buyerBalance = await hre.ethers.provider.getBalance(addr1.address);
      
      if (buyerBalance >= totalPrice) {
        const buyTx = await marketplace.connect(addr1).buyCredits(
          listingId,
          buyAmount,
          { value: totalPrice }
        );
        await buyTx.wait();
        
        log("✅ Purchase successful!", colors.green);
        
        const newBalance = await token.balanceOf(addr1.address);
        log(`   Buyer's new balance: ${formatToken(newBalance)} CCT\n`);
      } else {
        log("⚠️  Buyer has insufficient ETH for purchase", colors.yellow);
        log(`   Required: ${hre.ethers.formatEther(totalPrice)} ETH`);
        log(`   Available: ${hre.ethers.formatEther(buyerBalance)} ETH\n`);
      }
    } catch (error) {
      log(`❌ Error: ${error.message}`, colors.red);
    }
  }

  // ============================================
  // 9. RETIRE CARBON CREDITS
  // ============================================
  log("♻️  Step 9: Retiring Carbon Credits...", colors.yellow);
  try {
    const retireAmount = parseToken("1000");
    const creditId = 0;
    
    const balanceBefore = await token.balanceOf(signer.address);
    
    const retireTx = await token.retireCredits(retireAmount, creditId);
    await retireTx.wait();
    
    log("✅ Credits retired successfully", colors.green);
    log(`   Amount Retired: ${formatToken(retireAmount)} CCT`);
    
    const balanceAfter = await token.balanceOf(signer.address);
    log(`   Balance Before: ${formatToken(balanceBefore)} CCT`);
    log(`   Balance After: ${formatToken(balanceAfter)} CCT`);
    
    const totalRetired = await token.totalRetired();
    log(`   Total Retired (Global): ${formatToken(totalRetired)} CCT\n`);
    
    // Check if credits are retired
    const isRetired = await token.isRetired(creditId);
    log(`   Credit ID ${creditId} Retired: ${isRetired}\n`, colors.green);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 10. MINT RETIREMENT CERTIFICATE NFT
  // ============================================
  log("🎫 Step 10: Minting Retirement Certificate NFT...", colors.yellow);
  try {
    const mintNftTx = await nft.mintCertificate(
      signer.address,
      parseToken("1000"),
      0, // credit ID
      "Amazon Rainforest Conservation",
      "ipfs://QmYyyy...certificate-metadata"
    );
    await mintNftTx.wait();
    
    const tokenId = await nft.nextTokenId() - 1n;
    log("✅ Certificate NFT minted successfully", colors.green);
    log(`   Token ID: ${tokenId.toString()}`);
    
    const certificate = await nft.getCertificate(tokenId);
    log(`   Credits Retired: ${formatToken(certificate.creditsRetired)} CCT`);
    log(`   Project: ${certificate.projectName}`);
    log(`   Retired By: ${certificate.retiredBy}`);
    log(`   Timestamp: ${new Date(Number(certificate.retiredAt) * 1000).toLocaleString()}\n`);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 11. GET USER CERTIFICATES
  // ============================================
  log("📜 Step 11: Fetching User Certificates...", colors.yellow);
  try {
    const userCertificates = await nft.getUserCertificates(signer.address);
    
    log(`✅ Found ${userCertificates.length} certificate(s)`, colors.green);
    
    for (let i = 0; i < userCertificates.length; i++) {
      const tokenId = userCertificates[i];
      const certificate = await nft.getCertificate(tokenId);
      
      log(`\n   Certificate #${tokenId}:`);
      log(`   ├─ Credits: ${formatToken(certificate.creditsRetired)} CCT`);
      log(`   ├─ Project: ${certificate.projectName}`);
      log(`   └─ Date: ${new Date(Number(certificate.retiredAt) * 1000).toLocaleDateString()}`);
    }
    console.log();
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 12. EVENT LISTENING EXAMPLE
  // ============================================
  log("👂 Step 12: Setting Up Event Listeners...", colors.yellow);
  try {
    log("   Listening for CreditsMinted events...");
    
    // Listen for future events
    token.on("CreditsMinted", (to, amount, creditId, projectName, projectType) => {
      log(`\n🔔 New Credits Minted!`, colors.green);
      log(`   To: ${to}`);
      log(`   Amount: ${formatToken(amount)} CCT`);
      log(`   Credit ID: ${creditId.toString()}`);
      log(`   Project: ${projectName}`);
      log(`   Type: ${projectType}\n`);
    });

    // Listen for marketplace events
    marketplace.on("ListingCreated", (listingId, seller, amount, price, creditId) => {
      log(`\n🔔 New Listing Created!`, colors.green);
      log(`   Listing ID: ${listingId.toString()}`);
      log(`   Seller: ${seller}`);
      log(`   Amount: ${formatToken(amount)} CCT`);
      log(`   Price: ${hre.ethers.formatEther(price)} ETH/credit\n`);
    });

    log("✅ Event listeners configured\n", colors.green);
    log("ℹ️  Events will be displayed as they occur...\n", colors.blue);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // 13. QUERY PAST EVENTS
  // ============================================
  log("🔍 Step 13: Querying Past Events...", colors.yellow);
  try {
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 1000 > 0 ? currentBlock - 1000 : 0;
    
    const filter = token.filters.CreditsMinted();
    const events = await token.queryFilter(filter, fromBlock, currentBlock);
    
    log(`✅ Found ${events.length} CreditsMinted event(s)`, colors.green);
    
    events.forEach((event, index) => {
      log(`\n   Event #${index + 1}:`);
      log(`   ├─ Block: ${event.blockNumber}`);
      log(`   ├─ To: ${event.args.to}`);
      log(`   ├─ Amount: ${formatToken(event.args.amount)} CCT`);
      log(`   ├─ Project: ${event.args.projectName}`);
      log(`   └─ Type: ${event.args.projectType}`);
    });
    console.log();
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  // ============================================
  // SUMMARY
  // ============================================
  log("\n" + "═".repeat(50), colors.bright);
  log("📊 INTERACTION SUMMARY", colors.bright);
  log("═".repeat(50), colors.bright);
  
  try {
    const finalBalance = await token.balanceOf(signer.address);
    const totalSupply = await token.totalSupply();
    const nextCreditId = await token.nextCreditId();
    const totalRetired = await token.totalRetired();
    
    log(`Token Balance:        ${formatToken(finalBalance)} CCT`);
    log(`Total Supply:         ${formatToken(totalSupply)} CCT`);
    log(`Total Retired:        ${formatToken(totalRetired)} CCT`);
    log(`Credits Minted:       ${nextCreditId.toString()}`);
    log(`Active Listings:      ${(await marketplace.getActiveListings()).length}`);
    log(`Total Projects:       ${(await registry.totalProjects()).toString()}`);
    log("═".repeat(50) + "\n", colors.bright);
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
  }

  log("✨ Interaction script completed successfully! ✨\n", colors.green);
  log("💡 Tip: Run this script with different accounts to test full marketplace flow\n", colors.cyan);
}

// Execute main function
main()
  .then(() => {
    // Keep process alive for event listening
    log("Press Ctrl+C to exit...\n", colors.yellow);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
