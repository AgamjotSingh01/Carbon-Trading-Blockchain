const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonCreditRegistry", function () {
  async function deployRegistryFixture() {
    const [owner, issuer, verifier, addr3] = await ethers.getSigners();

    const CarbonCreditRegistry = await ethers.getContractFactory("CarbonCreditRegistry");
    const registry = await CarbonCreditRegistry.deploy();

    // Grant verifier role
    const VERIFIER_ROLE = await registry.VERIFIER_ROLE();
    await registry.grantRole(VERIFIER_ROLE, verifier.address);

    return { registry, owner, issuer, verifier, addr3 };
  }

  describe("Deployment", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to owner", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);
      const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant ADMIN_ROLE to owner", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);
      const ADMIN_ROLE = await registry.ADMIN_ROLE();
      expect(await registry.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Issuer Registration", function () {
    it("Should register issuer successfully", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await expect(registry.connect(issuer).registerIssuer("Green Energy Corp"))
        .to.emit(registry, "IssuerRegistered")
        .withArgs(issuer.address, "Green Energy Corp");

      const issuerData = await registry.issuers(issuer.address);
      expect(issuerData.name).to.equal("Green Energy Corp");
      expect(issuerData.isVerified).to.be.false;
      expect(issuerData.isActive).to.be.true;
    });

    it("Should fail to register with empty name", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(issuer).registerIssuer("")
      ).to.be.revertedWith("Name required");
    });

    it("Should fail if already registered", async function () {
      const { registry, issuer } = await loadFixture(deployRegistryFixture);

      await registry.connect(issuer).registerIssuer("Green Energy Corp");

      await expect(
        registry.connect(issuer).registerIssuer("Another Name")
      ).to.be.revertedWith("Already registered");
    });

    it("Should verify issuer successfully", async function () {
      const { registry, issuer, verifier } = await loadFixture(deployRegistryFixture);

      await registry.connect(issuer).registerIssuer("Green Energy Corp");

      await expect(registry.connect(verifier).verifyIssuer(issuer.address))
        .to.emit(registry, "IssuerVerified")
        .withArgs(issuer.address);

      const issuerData = await registry.issuers(issuer.address);
      expect(issuerData.isVerified).to.be.true;
    });

    it("Should fail to verify unregistered issuer", async function () {
      const { registry, addr3, verifier } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(verifier).verifyIssuer(addr3.address)
      ).to.be.revertedWith("Issuer not registered");
    });
  });

  describe("Project Registration", function () {
    async function registerIssuerFixture() {
      const fixture = await deployRegistryFixture();
      const { registry, issuer } = fixture;
      
      await registry.connect(issuer).registerIssuer("Green Energy Corp");
      
      return fixture;
    }

    it("Should register project successfully", async function () {
      const { registry, issuer } = await loadFixture(registerIssuerFixture);

      await expect(
        registry.connect(issuer).registerProject(
          "Solar Farm California",
          "Renewable Energy",
          "California, USA",
          "ipfs://metadata"
        )
      )
        .to.emit(registry, "ProjectRegistered")
        .withArgs(0, "Solar Farm California", issuer.address);

      const project = await registry.projects(0);
      expect(project.name).to.equal("Solar Farm California");
      expect(project.projectType).to.equal("Renewable Energy");
      expect(project.isVerified).to.be.false;
      expect(project.isActive).to.be.true;
    });

    it("Should fail if issuer not registered", async function () {
      const { registry, addr3 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(addr3).registerProject(
          "Project",
          "Type",
          "Location",
          "ipfs://metadata"
        )
      ).to.be.revertedWith("Not a registered issuer");
    });

    it("Should fail with empty project name", async function () {
      const { registry, issuer } = await loadFixture(registerIssuerFixture);

      await expect(
        registry.connect(issuer).registerProject("", "Type", "Location", "ipfs://metadata")
      ).to.be.revertedWith("Name required");
    });

    it("Should track issuer projects", async function () {
      const { registry, issuer } = await loadFixture(registerIssuerFixture);

      await registry.connect(issuer).registerProject("Project 1", "Type", "Location", "uri1");
      await registry.connect(issuer).registerProject("Project 2", "Type", "Location", "uri2");

      const issuerProjects = await registry.getIssuerProjects(issuer.address);
      expect(issuerProjects.length).to.equal(2);
      expect(issuerProjects[0]).to.equal(0);
      expect(issuerProjects[1]).to.equal(1);

      const issuerData = await registry.issuers(issuer.address);
      expect(issuerData.projectsRegistered).to.equal(2);
    });
  });

  describe("Project Verification", function () {
    async function registerProjectFixture() {
      const fixture = await deployRegistryFixture();
      const { registry, issuer } = fixture;
      
      await registry.connect(issuer).registerIssuer("Green Energy Corp");
      await registry.connect(issuer).registerProject(
        "Solar Farm",
        "Renewable Energy",
        "California",
        "ipfs://metadata"
      );
      
      return fixture;
    }

    it("Should verify project successfully", async function () {
      const { registry, verifier } = await loadFixture(registerProjectFixture);

      await expect(registry.connect(verifier).verifyProject(0))
        .to.emit(registry, "ProjectVerified")
        .withArgs(0, verifier.address);

      const project = await registry.projects(0);
      expect(project.isVerified).to.be.true;
      expect(await registry.totalVerifiedProjects()).to.equal(1);
    });

    it("Should fail to verify invalid project ID", async function () {
      const { registry, verifier } = await loadFixture(registerProjectFixture);

      await expect(
        registry.connect(verifier).verifyProject(999)
      ).to.be.revertedWith("Invalid project ID");
    });

    it("Should fail to verify already verified project", async function () {
      const { registry, verifier } = await loadFixture(registerProjectFixture);

      await registry.connect(verifier).verifyProject(0);

      await expect(
        registry.connect(verifier).verifyProject(0)
      ).to.be.revertedWith("Already verified");
    });

    it("Should fail if non-verifier tries to verify", async function () {
      const { registry, issuer } = await loadFixture(registerProjectFixture);

      await expect(
        registry.connect(issuer).verifyProject(0)
      ).to.be.reverted;
    });
  });

  describe("Credits Issued Tracking", function () {
    async function registerProjectFixture() {
      const fixture = await deployRegistryFixture();
      const { registry, issuer, owner } = fixture;
      
      await registry.connect(issuer).registerIssuer("Green Energy Corp");
      await registry.connect(issuer).registerProject(
        "Solar Farm",
        "Renewable Energy",
        "California",
        "ipfs://metadata"
      );
      
      return fixture;
    }

    it("Should record credits issued", async function () {
      const { registry, owner } = await loadFixture(registerProjectFixture);

      const amount = ethers.parseUnits("1000", 18);

      await expect(registry.connect(owner).recordCreditsIssued(0, amount))
        .to.emit(registry, "CreditsIssued")
        .withArgs(0, amount);

      const project = await registry.projects(0);
      expect(project.totalCreditsIssued).to.equal(amount);
    });

    it("Should fail to record for invalid project", async function () {
      const { registry, owner } = await loadFixture(registerProjectFixture);

      await expect(
        registry.connect(owner).recordCreditsIssued(999, 1000)
      ).to.be.revertedWith("Invalid project ID");
    });
  });

  describe("Project Deactivation", function () {
    async function registerProjectFixture() {
      const fixture = await deployRegistryFixture();
      const { registry, issuer } = fixture;
      
      await registry.connect(issuer).registerIssuer("Green Energy Corp");
      await registry.connect(issuer).registerProject(
        "Solar Farm",
        "Renewable Energy",
        "California",
        "ipfs://metadata"
      );
      
      return fixture;
    }

    it("Should deactivate project successfully", async function () {
      const { registry, owner } = await loadFixture(registerProjectFixture);

      await expect(registry.connect(owner).deactivateProject(0))
        .to.emit(registry, "ProjectDeactivated")
        .withArgs(0);

      const project = await registry.projects(0);
      expect(project.isActive).to.be.false;
    });

    it("Should fail to deactivate invalid project", async function () {
      const { registry, owner } = await loadFixture(registerProjectFixture);

      await expect(
        registry.connect(owner).deactivateProject(999)
      ).to.be.revertedWith("Invalid project ID");
    });
  });

  describe("Query Functions", function () {
    async function setupMultipleProjectsFixture() {
      const fixture = await deployRegistryFixture();
      const { registry, issuer, verifier } = fixture;
      
      await registry.connect(issuer).registerIssuer("Green Energy Corp");
      await registry.connect(issuer).registerProject("Project 1", "Type 1", "Location 1", "uri1");
      await registry.connect(issuer).registerProject("Project 2", "Type 2", "Location 2", "uri2");
      await registry.connect(verifier).verifyProject(0);
      
      return fixture;
    }

    it("Should get project details", async function () {
      const { registry } = await loadFixture(setupMultipleProjectsFixture);

      const project = await registry.getProject(0);
      expect(project.name).to.equal("Project 1");
      expect(project.projectType).to.equal("Type 1");
      expect(project.location).to.equal("Location 1");
      expect(project.isVerified).to.be.true;
    });

    it("Should check if project is verified", async function () {
      const { registry } = await loadFixture(setupMultipleProjectsFixture);

      expect(await registry.isProjectVerified(0)).to.be.true;
      expect(await registry.isProjectVerified(1)).to.be.false;
    });
  });
});
