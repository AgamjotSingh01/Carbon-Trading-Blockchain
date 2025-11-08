const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonCreditToken", function () {
  // Fixture to deploy contract
  async function deployTokenFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const CarbonCreditToken = await ethers.getContractFactory("CarbonCreditToken");
    const token = await CarbonCreditToken.deploy();

    return { token, owner, addr1, addr2, addr3 };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Carbon Credit Token");
      expect(await token.symbol()).to.equal("CCT");
    });

    it("Should grant DEFAULT_ADMIN_ROLE to owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant MINTER_ROLE to owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const MINTER_ROLE = await token.MINTER_ROLE();
      expect(await token.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint credits with correct metadata", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const projectName = "Solar Farm Project";
      const projectType = "Renewable Energy";
      const location = "California, USA";
      const vintage = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

      await expect(
        token.mintCredits(addr1.address, amount, projectName, projectType, location, vintage)
      )
        .to.emit(token, "CreditsMinted")
        .withArgs(addr1.address, amount, 0, projectName, projectType);

      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should increment credit ID correctly", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("500", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount, "Project 1", "Type 1", "Location 1", vintage);
      await token.mintCredits(addr1.address, amount, "Project 2", "Type 2", "Location 2", vintage);

      expect(await token.nextCreditId()).to.equal(2);
    });

    it("Should fail if non-minter tries to mint", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await expect(
        token.connect(addr1).mintCredits(
          addr1.address,
          amount,
          "Project",
          "Type",
          "Location",
          vintage
        )
      ).to.be.reverted;
    });

    it("Should fail with zero amount", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      const vintage = Math.floor(Date.now() / 1000);

      await expect(
        token.mintCredits(addr1.address, 0, "Project", "Type", "Location", vintage)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should fail with empty project name", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await expect(
        token.mintCredits(addr1.address, amount, "", "Type", "Location", vintage)
      ).to.be.revertedWith("Project name required");
    });
  });

  describe("Retiring Credits", function () {
    it("Should retire credits successfully", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const mintAmount = ethers.parseUnits("1000", 18);
      const retireAmount = ethers.parseUnits("500", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(
        addr1.address,
        mintAmount,
        "Project",
        "Type",
        "Location",
        vintage
      );

      await expect(token.connect(addr1).retireCredits(retireAmount, 0))
        .to.emit(token, "CreditsRetired")
        .withArgs(addr1.address, retireAmount, 0, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

      expect(await token.balanceOf(addr1.address)).to.equal(mintAmount - retireAmount);
      expect(await token.totalRetired()).to.equal(retireAmount);
    });

    it("Should update metadata when retiring", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount, "Project", "Type", "Location", vintage);
      await token.connect(addr1).retireCredits(amount, 0);

      const metadata = await token.getCreditMetadata(0);
      expect(metadata.isRetired).to.be.true;
      expect(metadata.retiredBy).to.equal(addr1.address);
    });

    it("Should fail with insufficient balance", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);

      await expect(
        token.connect(addr1).retireCredits(amount, 0)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should fail when retiring already retired credits", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const vintage = Math.floor(Date.now() / 1000);

      // Mint enough tokens for the test
      await token.mintCredits(addr1.address, amount, "Project", "Type", "Location", vintage);
      
      // Retire credits once
      await token.connect(addr1).retireCredits(amount, 0);

      // Mint more tokens to ensure balance is sufficient
      await token.mintCredits(addr1.address, amount, "Project 2", "Type", "Location", vintage);

      // Try to retire the same credit ID again - should fail
      await expect(
        token.connect(addr1).retireCredits(amount, 0)
      ).to.be.revertedWith("Credits already retired");
    });
  }); // <-- THIS WAS MISSING! Closing brace for "Retiring Credits"

  describe("Metadata and Queries", function () {
    it("Should return correct credit metadata", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const projectName = "Wind Farm";
      const projectType = "Renewable Energy";
      const location = "Texas";
      const vintage = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

      await token.mintCredits(addr1.address, amount, projectName, projectType, location, vintage);

      const metadata = await token.getCreditMetadata(0);
      expect(metadata.projectName).to.equal(projectName);
      expect(metadata.projectType).to.equal(projectType);
      expect(metadata.location).to.equal(location);
      expect(metadata.isRetired).to.be.false;
    });

    it("Should track user retired credits", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount, "Project 1", "Type", "Location", vintage);
      await token.mintCredits(addr1.address, amount, "Project 2", "Type", "Location", vintage);

      await token.connect(addr1).retireCredits(ethers.parseUnits("500", 18), 0);
      await token.connect(addr1).retireCredits(ethers.parseUnits("500", 18), 1);

      const retiredCredits = await token.getUserRetiredCredits(addr1.address);
      expect(retiredCredits.length).to.equal(2);
      expect(retiredCredits[0]).to.equal(0);
      expect(retiredCredits[1]).to.equal(1);
    });

    it("Should track project credits correctly", async function () {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      const amount1 = ethers.parseUnits("1000", 18);
      const amount2 = ethers.parseUnits("2000", 18);
      const projectName = "Solar Project";
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount1, projectName, "Type", "Location", vintage);
      await token.mintCredits(addr2.address, amount2, projectName, "Type", "Location", vintage);

      const totalProjectCredits = await token.getProjectCredits(projectName);
      expect(totalProjectCredits).to.equal(amount1 + amount2);
    });
  });

  describe("Transfer and Burn", function () {
    it("Should transfer credits between accounts", async function () {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const transferAmount = ethers.parseUnits("300", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount, "Project", "Type", "Location", vintage);
      await token.connect(addr1).transfer(addr2.address, transferAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(amount - transferAmount);
      expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
    });

    it("Should allow burning tokens", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const burnAmount = ethers.parseUnits("400", 18);
      const vintage = Math.floor(Date.now() / 1000);

      await token.mintCredits(addr1.address, amount, "Project", "Type", "Location", vintage);
      await token.connect(addr1).burn(burnAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(amount - burnAmount);
    });
  });
});
