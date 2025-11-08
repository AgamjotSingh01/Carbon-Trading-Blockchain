// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CarbonCreditRegistry
 * @dev Registry for managing verified carbon credit projects and issuers
 */
contract CarbonCreditRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    struct Project {
        string name;
        string projectType;
        string location;
        address owner;
        uint256 registeredAt;
        bool isVerified;
        bool isActive;
        uint256 totalCreditsIssued;
        string metadataURI;
    }
    
    struct Issuer {
        string name;
        address issuerAddress;
        bool isVerified;
        bool isActive;
        uint256 registeredAt;
        uint256 projectsRegistered;
    }
    
    mapping(uint256 => Project) public projects;
    mapping(address => Issuer) public issuers;
    mapping(address => uint256[]) public issuerProjects;
    mapping(address => bool) public isRegisteredIssuer;
    
    uint256 public nextProjectId;
    uint256 public totalProjects;
    uint256 public totalVerifiedProjects;
    
    event ProjectRegistered(
        uint256 indexed projectId,
        string name,
        address indexed owner
    );
    
    event ProjectVerified(uint256 indexed projectId, address indexed verifier);
    event ProjectDeactivated(uint256 indexed projectId);
    event IssuerRegistered(address indexed issuer, string name);
    event IssuerVerified(address indexed issuer);
    event CreditsIssued(uint256 indexed projectId, uint256 amount);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Register a new issuer
     */
    function registerIssuer(string memory name) external {
        require(!isRegisteredIssuer[msg.sender], "Already registered");
        require(bytes(name).length > 0, "Name required");
        
        issuers[msg.sender] = Issuer({
            name: name,
            issuerAddress: msg.sender,
            isVerified: false,
            isActive: true,
            registeredAt: block.timestamp,
            projectsRegistered: 0
        });
        
        isRegisteredIssuer[msg.sender] = true;
        
        emit IssuerRegistered(msg.sender, name);
    }
    
    /**
     * @dev Verify an issuer (only verifiers)
     */
    function verifyIssuer(address issuerAddress) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(isRegisteredIssuer[issuerAddress], "Issuer not registered");
        
        issuers[issuerAddress].isVerified = true;
        
        emit IssuerVerified(issuerAddress);
    }
    
    /**
     * @dev Register a new carbon credit project
     */
    function registerProject(
        string memory name,
        string memory projectType,
        string memory location,
        string memory metadataURI
    ) external returns (uint256) {
        require(isRegisteredIssuer[msg.sender], "Not a registered issuer");
        require(issuers[msg.sender].isActive, "Issuer not active");
        require(bytes(name).length > 0, "Name required");
        
        uint256 projectId = nextProjectId++;
        
        projects[projectId] = Project({
            name: name,
            projectType: projectType,
            location: location,
            owner: msg.sender,
            registeredAt: block.timestamp,
            isVerified: false,
            isActive: true,
            totalCreditsIssued: 0,
            metadataURI: metadataURI
        });
        
        issuerProjects[msg.sender].push(projectId);
        issuers[msg.sender].projectsRegistered++;
        totalProjects++;
        
        emit ProjectRegistered(projectId, name, msg.sender);
        
        return projectId;
    }
    
    /**
     * @dev Verify a project (only verifiers)
     */
    function verifyProject(uint256 projectId) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(projectId < nextProjectId, "Invalid project ID");
        require(!projects[projectId].isVerified, "Already verified");
        
        projects[projectId].isVerified = true;
        totalVerifiedProjects++;
        
        emit ProjectVerified(projectId, msg.sender);
    }
    
    /**
     * @dev Record credits issued for a project
     */
    function recordCreditsIssued(uint256 projectId, uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(projectId < nextProjectId, "Invalid project ID");
        require(projects[projectId].isActive, "Project not active");
        
        projects[projectId].totalCreditsIssued += amount;
        
        emit CreditsIssued(projectId, amount);
    }
    
    /**
     * @dev Deactivate a project
     */
    function deactivateProject(uint256 projectId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(projectId < nextProjectId, "Invalid project ID");
        
        projects[projectId].isActive = false;
        
        emit ProjectDeactivated(projectId);
    }
    
    /**
     * @dev Get project details
     */
    function getProject(uint256 projectId) 
        external 
        view 
        returns (Project memory) 
    {
        require(projectId < nextProjectId, "Invalid project ID");
        return projects[projectId];
    }
    
    /**
     * @dev Get issuer's projects
     */
    function getIssuerProjects(address issuer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return issuerProjects[issuer];
    }
    
    /**
     * @dev Check if project is verified
     */
    function isProjectVerified(uint256 projectId) 
        external 
        view 
        returns (bool) 
    {
        require(projectId < nextProjectId, "Invalid project ID");
        return projects[projectId].isVerified;
    }
}
