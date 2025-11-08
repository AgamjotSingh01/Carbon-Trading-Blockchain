const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging price calculation...\n");

  const buyAmount = ethers.parseUnits("500", 18);
  const pricePerCredit = ethers.parseEther("0.01");

  console.log("buyAmount:", buyAmount.toString());
  console.log("pricePerCredit:", pricePerCredit.toString());
  console.log("1 ether:", ethers.parseUnits("1", 18).toString());

  // Method 1: multiply then divide
  const method1 = (buyAmount * pricePerCredit) / ethers.parseUnits("1", 18);
  console.log("\nMethod 1 (multiply then divide):", method1.toString());
  console.log("In ETH:", ethers.formatEther(method1));

  // Method 2: The way the contract does it
  const method2 = buyAmount * pricePerCredit;
  console.log("\nMethod 2 (multiply only):", method2.toString());
  
  // What the contract expects
  console.log("\nWhat we should send:", ethers.formatEther(method1), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
