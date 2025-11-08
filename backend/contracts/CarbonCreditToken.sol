// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CarbonCreditToken
 * @dev ERC20 token representing carbon credits with minting and burning capabilities
 */
contract CarbonCreditToken is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    struct CreditMetadata {
        string projectName;
        string projectType;
        string location;
        uint256 vintage;
        uint256 timestamp;
        bool isRetired;
        address retiredBy;
        uint256 retiredAt;
    }
    
    // Credit ID to metadata mapping
    mapping(uint256 => CreditMetadata) public creditMetadata;
    
    // User to their retired credits
    mapping(address => uint256[]) public userRetiredCredits;
    
    // Total credits minted per project
    mapping(string => uint256) public projectCredits;
    
    uint256 public nextCreditId;
    uint256 public totalRetired;
    
    // Events
    event CreditsMinted(
        address indexed to,
        uint256 amount,
        uint256 indexed creditId,
        string projectName,
        string projectType
    );
    
    event CreditsRetired(
        address indexed from,
        uint256 amount,
        uint256 indexed creditId,
        uint256 timestamp
    );
    
    event MetadataUpdated(
        uint256 indexed creditId,
        string projectName,
        string projectType
    );
    
    constructor() ERC20("Carbon Credit Token", "CCT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint new carbon credits with metadata
     * @param to Address to receive the credits
     * @param amount Amount of credits to mint
     * @param projectName Name of the carbon offset project
     * @param projectType Type of project (e.g., Renewable Energy, Forestry)
     * @param location Geographic location of the project
     * @param vintage Year the carbon reduction occurred
     */
    function mintCredits(
        address to,
        uint256 amount,
        string memory projectName,
        string memory projectType,
        string memory location,
        uint256 vintage
    ) public onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(projectName).length > 0, "Project name required");
        require(vintage <= block.timestamp, "Invalid vintage year");
        
        uint256 creditId = nextCreditId++;
        
        creditMetadata[creditId] = CreditMetadata({
            projectName: projectName,
            projectType: projectType,
            location: location,
            vintage: vintage,
            timestamp: block.timestamp,
            isRetired: false,
            retiredBy: address(0),
            retiredAt: 0
        });
        
        projectCredits[projectName] += amount;
        
        _mint(to, amount);
        
        emit CreditsMinted(to, amount, creditId, projectName, projectType);
        
        return creditId;
    }
    
    /**
     * @dev Retire carbon credits (burn them permanently)
     * @param amount Amount of credits to retire
     * @param creditId ID of the credit being retired
     */
    function retireCredits(uint256 amount, uint256 creditId) public nonReentrant {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(creditId < nextCreditId, "Invalid credit ID");
        require(!creditMetadata[creditId].isRetired, "Credits already retired");
        
        creditMetadata[creditId].isRetired = true;
        creditMetadata[creditId].retiredBy = msg.sender;
        creditMetadata[creditId].retiredAt = block.timestamp;
        
        userRetiredCredits[msg.sender].push(creditId);
        totalRetired += amount;
        
        _burn(msg.sender, amount);
        
        emit CreditsRetired(msg.sender, amount, creditId, block.timestamp);
    }
    
    /**
     * @dev Get credit metadata by ID
     */
    function getCreditMetadata(uint256 creditId) 
        public 
        view 
        returns (CreditMetadata memory) 
    {
        require(creditId < nextCreditId, "Invalid credit ID");
        return creditMetadata[creditId];
    }
    
    /**
     * @dev Get all retired credits for a user
     */
    function getUserRetiredCredits(address user) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return userRetiredCredits[user];
    }
    
    /**
     * @dev Get total credits for a specific project
     */
    function getProjectCredits(string memory projectName) 
        public 
        view 
        returns (uint256) 
    {
        return projectCredits[projectName];
    }
    
    /**
     * @dev Check if credits are retired
     */
    function isRetired(uint256 creditId) public view returns (bool) {
        require(creditId < nextCreditId, "Invalid credit ID");
        return creditMetadata[creditId].isRetired;
    }
}
