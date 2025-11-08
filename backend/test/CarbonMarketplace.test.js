const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonMarketplace", function () {
  async function deployMarketplaceFixture() {
    const [owner, seller, buyer, addr3] = await ethers.getSigners();

    // Deploy token
    const CarbonCreditToken = await ethers.getContractFactory("CarbonCreditToken");
    const token = await CarbonCreditToken.deploy();

    // Deploy marketplace
    const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
    const marketplace = await CarbonMarketplace.deploy(await token.getAddress());

    // Mint tokens to seller
    const amount = ethers.parseUnits("10000", 18);
    const vintage = Math.floor(Date.now() / 1000);
    await token.mintCredits(
      seller.address,
      amount,
      "Test Project",
      "Renewable Energy",
      "USA",
      vintage
    );

    return { token, marketplace, owner, seller, buyer, addr3 };
  }

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      const { token, marketplace } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.carbonToken()).to.equal(await token.getAddress());
    });

    it("Should set default platform fee", async function () {
      const { marketplace } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.platformFee()).to.equal(25); // 0.25%
    });

    it("Should set the correct owner", async function () {
      const { marketplace, owner } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Creating Listings", function () {
    it("Should create a listing successfully", async function () {
      const { token, marketplace, seller } = await loadFixture(deployMarketplaceFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await token.connect(seller).approve(await marketplace.getAddress(), amount);

      await expect(
        marketplace.connect(seller).createListing(amount, price, 0, "Test Project")
      )
        .to.emit(marketplace, "ListingCreated")
        .withArgs(0, seller.address, amount, price, 0);

      const listing = await marketplace.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.amount).to.equal(amount);
      expect(listing.pricePerCredit).to.equal(price);
      expect(listing.isActive).to.be.true;
    });

    it("Should fail with zero amount", async function () {
      const { marketplace, seller } = await loadFixture(deployMarketplaceFixture);
      
      const price = ethers.parseEther("0.01");

      await expect(
        marketplace.connect(seller).createListing(0, price, 0, "Test Project")
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should fail with zero price", async function () {
      const { token, marketplace, seller } = await loadFixture(deployMarketplaceFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      await token.connect(seller).approve(await marketplace.getAddress(), amount);

      await expect(
        marketplace.connect(seller).createListing(amount, 0, 0, "Test Project")
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should fail without token approval", async function () {
      const { marketplace, seller } = await loadFixture(deployMarketplaceFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await expect(
        marketplace.connect(seller).createListing(amount, price, 0, "Test Project")
      ).to.be.reverted;
    });
  });

  describe("Buying Credits", function () {
    async function createListingFixture() {
      const fixture = await deployMarketplaceFixture();
      const { token, marketplace, seller } = fixture;
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await token.connect(seller).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(seller).createListing(amount, price, 0, "Test Project");

      return { ...fixture, listingAmount: amount, listingPrice: price };
    }

    it("Should buy credits successfully", async function () {
      const { marketplace, token, buyer, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const buyAmount = ethers.parseUnits("500", 18);
      const totalPrice = (buyAmount * listingPrice) / ethers.parseUnits("1", 18);

      await expect(
        marketplace.connect(buyer).buyCredits(0, buyAmount, { value: totalPrice })
      )
        .to.emit(marketplace, "ListingSold");

      expect(await token.balanceOf(buyer.address)).to.equal(buyAmount);
    });

    it("Should calculate platform fee correctly", async function () {
      const { marketplace, buyer, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const buyAmount = ethers.parseUnits("1000", 18);
      const totalPrice = (buyAmount * listingPrice) / ethers.parseUnits("1", 18);

      await marketplace.connect(buyer).buyCredits(0, buyAmount, { value: totalPrice });

      const fee = (totalPrice * 25n) / 10000n;
      
      const marketplaceBalance = await ethers.provider.getBalance(await marketplace.getAddress());
      expect(marketplaceBalance).to.be.closeTo(fee, ethers.parseEther("0.0001"));
    });

    it("Should refund excess payment", async function () {
      const { marketplace, buyer, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const buyAmount = ethers.parseUnits("500", 18);
      const totalPrice = (buyAmount * listingPrice) / ethers.parseUnits("1", 18);
      const excessPayment = ethers.parseEther("1");

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace.connect(buyer).buyCredits(
        0,
        buyAmount,
        { value: totalPrice + excessPayment }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      const actualSpent = buyerBalanceBefore - buyerBalanceAfter;

      expect(actualSpent).to.be.closeTo(
        totalPrice + gasUsed,
        ethers.parseEther("0.001")
      );
    });

    it("Should fail with insufficient payment", async function () {
      const { marketplace, buyer, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const buyAmount = ethers.parseUnits("500", 18);
      const totalPrice = (buyAmount * listingPrice) / ethers.parseUnits("1", 18);
      const insufficientPayment = totalPrice / 2n;

      await expect(
        marketplace.connect(buyer).buyCredits(0, buyAmount, { value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail when buying own listing", async function () {
      const { marketplace, seller, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const buyAmount = ethers.parseUnits("500", 18);
      const totalPrice = (buyAmount * listingPrice) / ethers.parseUnits("1", 18);

      await expect(
        marketplace.connect(seller).buyCredits(0, buyAmount, { value: totalPrice })
      ).to.be.revertedWith("Cannot buy own listing");
    });

    it("Should deactivate listing when fully sold", async function () {
      const { marketplace, buyer, listingAmount, listingPrice } = 
        await loadFixture(createListingFixture);
      
      const totalPrice = (listingAmount * listingPrice) / ethers.parseUnits("1", 18);

      await marketplace.connect(buyer).buyCredits(0, listingAmount, { value: totalPrice });

      const listing = await marketplace.listings(0);
      expect(listing.isActive).to.be.false;
      expect(listing.amount).to.equal(0);
    });
  });

  describe("Cancelling Listings", function () {
    async function createListingFixture() {
      const fixture = await deployMarketplaceFixture();
      const { token, marketplace, seller } = fixture;
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await token.connect(seller).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(seller).createListing(amount, price, 0, "Test Project");

      return { ...fixture, listingAmount: amount };
    }

    it("Should cancel listing successfully", async function () {
      const { marketplace, token, seller, listingAmount } = 
        await loadFixture(createListingFixture);

      await expect(marketplace.connect(seller).cancelListing(0))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(0, seller.address);

      const listing = await marketplace.listings(0);
      expect(listing.isActive).to.be.false;
      expect(await token.balanceOf(seller.address)).to.equal(
        ethers.parseUnits("10000", 18)
      );
    });

    it("Should fail when non-owner tries to cancel", async function () {
      const { marketplace, buyer } = await loadFixture(createListingFixture);

      await expect(
        marketplace.connect(buyer).cancelListing(0)
      ).to.be.revertedWith("Not listing owner");
    });

    it("Should fail when cancelling inactive listing", async function () {
      const { marketplace, seller } = await loadFixture(createListingFixture);

      await marketplace.connect(seller).cancelListing(0);

      await expect(
        marketplace.connect(seller).cancelListing(0)
      ).to.be.revertedWith("Listing not active");
    });
  });

  describe("Updating Listings", function () {
    async function createListingFixture() {
      const fixture = await deployMarketplaceFixture();
      const { token, marketplace, seller } = fixture;
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await token.connect(seller).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(seller).createListing(amount, price, 0, "Test Project");

      return fixture;
    }

    it("Should update listing price successfully", async function () {
      const { marketplace, seller } = await loadFixture(createListingFixture);
      
      const newPrice = ethers.parseEther("0.02");

      await expect(marketplace.connect(seller).updateListingPrice(0, newPrice))
        .to.emit(marketplace, "ListingUpdated");

      const listing = await marketplace.listings(0);
      expect(listing.pricePerCredit).to.equal(newPrice);
    });

    it("Should fail when non-owner tries to update", async function () {
      const { marketplace, buyer } = await loadFixture(createListingFixture);
      
      const newPrice = ethers.parseEther("0.02");

      await expect(
        marketplace.connect(buyer).updateListingPrice(0, newPrice)
      ).to.be.revertedWith("Not listing owner");
    });
  });

  describe("Admin Functions", function () {
    it("Should update platform fee", async function () {
      const { marketplace, owner } = await loadFixture(deployMarketplaceFixture);
      
      const newFee = 50; // 0.5%

      await expect(marketplace.connect(owner).updatePlatformFee(newFee))
        .to.emit(marketplace, "PlatformFeeUpdated")
        .withArgs(25, newFee);

      expect(await marketplace.platformFee()).to.equal(newFee);
    });

    it("Should fail to set fee above maximum", async function () {
      const { marketplace, owner } = await loadFixture(deployMarketplaceFixture);
      
      const highFee = 600; // 6%

      await expect(
        marketplace.connect(owner).updatePlatformFee(highFee)
      ).to.be.revertedWith("Fee too high (max 5%)");
    });

    it("Should fail when non-owner tries to update fee", async function () {
      const { marketplace, seller } = await loadFixture(deployMarketplaceFixture);

      await expect(
        marketplace.connect(seller).updatePlatformFee(50)
      ).to.be.reverted;
    });
  });

  describe("Marketplace Statistics", function () {
    it("Should track marketplace stats correctly", async function () {
      const { token, marketplace, seller, buyer } = 
        await loadFixture(deployMarketplaceFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      const price = ethers.parseEther("0.01");

      await token.connect(seller).approve(await marketplace.getAddress(), amount);
      await marketplace.connect(seller).createListing(amount, price, 0, "Test Project");

      const totalPrice = (amount * price) / ethers.parseUnits("1", 18);
      await marketplace.connect(buyer).buyCredits(0, amount, { value: totalPrice });

      const stats = await marketplace.getMarketplaceStats();
      expect(stats[0]).to.equal(1);
      expect(stats[1]).to.equal(totalPrice);
      expect(stats[2]).to.equal(1);
    });
  });
});
