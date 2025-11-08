// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CarbonCreditNFT
 * @dev NFT certificates for retired carbon credits
 */
contract CarbonCreditNFT is ERC721, ERC721URIStorage, AccessControl {
    using Strings for uint256;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    struct Certificate {
        uint256 creditsRetired;
        uint256 creditId;
        string projectName;
        address retiredBy;
        uint256 retiredAt;
        string certificateURI;
    }
    
    mapping(uint256 => Certificate) public certificates;
    mapping(address => uint256[]) public userCertificates;
    
    uint256 public nextTokenId;
    
    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 creditsRetired,
        uint256 creditId
    );
    
    constructor() ERC721("Carbon Credit Certificate", "CCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint a certificate NFT for retired credits
     */
    function mintCertificate(
        address to,
        uint256 creditsRetired,
        uint256 creditId,
        string memory projectName,
        string memory certificateURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(to != address(0), "Invalid address");
        require(creditsRetired > 0, "Credits must be greater than 0");
        
        uint256 tokenId = nextTokenId++;
        
        certificates[tokenId] = Certificate({
            creditsRetired: creditsRetired,
            creditId: creditId,
            projectName: projectName,
            retiredBy: to,
            retiredAt: block.timestamp,
            certificateURI: certificateURI
        });
        
        userCertificates[to].push(tokenId);
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, certificateURI);
        
        emit CertificateMinted(tokenId, to, creditsRetired, creditId);
        
        return tokenId;
    }
    
    /**
     * @dev Get certificate details
     */
    function getCertificate(uint256 tokenId) 
        external 
        view 
        returns (Certificate memory) 
    {
        require(tokenId < nextTokenId, "Invalid token ID");
        return certificates[tokenId];
    }
    
    /**
     * @dev Get all certificates owned by a user
     */
    function getUserCertificates(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userCertificates[user];
    }
    
    // Override required functions
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
