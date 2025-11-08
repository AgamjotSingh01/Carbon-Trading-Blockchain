// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CarbonMarketplace
 * @dev Decentralized marketplace for trading carbon credits
 */
contract CarbonMarketplace is Ownable, ReentrancyGuard {
    IERC20 public carbonToken;
    
    struct Listing {
        address seller;
        uint256 amount;
        uint256 pricePerCredit; // Price in wei per credit
        bool isActive;
        uint256 createdAt;
        uint256 creditId;
        string projectName;
    }
    
    struct Trade {
        uint256 listingId;
        address buyer;
        address seller;
        uint256 amount;
        uint256 totalPrice;
        uint256 timestamp;
    }
    
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256[]) public userListings;
    mapping(address => Trade[]) public userTrades;
    
    uint256 public nextListingId;
    uint256 public platformFee = 25; // 0.25% fee (25/10000)
    uint256 public totalVolume;
    uint256 public totalTrades;
    
    // Events
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 amount,
        uint256 pricePerCredit,
        uint256 creditId
    );
    
    event ListingSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPrice
    );
    
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    
    event ListingUpdated(
        uint256 indexed listingId,
        uint256 newAmount,
        uint256 newPrice
    );
    
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(address _carbonToken) Ownable(msg.sender) {
        require(_carbonToken != address(0), "Invalid token address");
        carbonToken = IERC20(_carbonToken);
    }
    
    /**
     * @dev Create a new listing to sell carbon credits
     */
    function createListing(
        uint256 amount,
        uint256 pricePerCredit,
        uint256 creditId,
        string memory projectName
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(pricePerCredit > 0, "Price must be greater than 0");
        require(
            carbonToken.balanceOf(msg.sender) >= amount,
            "Insufficient token balance"
        );
        
        // Transfer tokens to marketplace
        require(
            carbonToken.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        
        uint256 listingId = nextListingId++;
        
        listings[listingId] = Listing({
            seller: msg.sender,
            amount: amount,
            pricePerCredit: pricePerCredit,
            isActive: true,
            createdAt: block.timestamp,
            creditId: creditId,
            projectName: projectName
        });
        
        userListings[msg.sender].push(listingId);
        
        emit ListingCreated(
            listingId,
            msg.sender,
            amount,
            pricePerCredit,
            creditId
        );
        
        return listingId;
    }
    
    /**
     * @dev Buy carbon credits from a listing
     */
    function buyCredits(uint256 listingId, uint256 amount) 
        external 
        payable 
        nonReentrant 
    {
        Listing storage listing = listings[listingId];
        
        require(listing.isActive, "Listing not active");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= listing.amount, "Insufficient credits available");
        require(msg.sender != listing.seller, "Cannot buy own listing");
        
        // FIXED: Divide by 10^18 to account for token decimals
        uint256 totalPrice = (amount * listing.pricePerCredit) / 1e18;
        uint256 fee = (totalPrice * platformFee) / 10000;
        uint256 sellerAmount = totalPrice - fee;
        
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Update listing
        listing.amount -= amount;
        if (listing.amount == 0) {
            listing.isActive = false;
        }
        
        // Transfer tokens to buyer
        require(
            carbonToken.transfer(msg.sender, amount),
            "Token transfer failed"
        );
        
        // Transfer payment to seller
        (bool successSeller, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(successSeller, "Seller payment failed");
        
        // Refund excess payment
        if (msg.value > totalPrice) {
            (bool successRefund, ) = payable(msg.sender).call{
                value: msg.value - totalPrice
            }("");
            require(successRefund, "Refund failed");
        }
        
        // Record trade
        Trade memory trade = Trade({
            listingId: listingId,
            buyer: msg.sender,
            seller: listing.seller,
            amount: amount,
            totalPrice: totalPrice,
            timestamp: block.timestamp
        });
        
        userTrades[msg.sender].push(trade);
        userTrades[listing.seller].push(trade);
        
        totalVolume += totalPrice;
        totalTrades++;
        
        emit ListingSold(
            listingId,
            msg.sender,
            listing.seller,
            amount,
            totalPrice
        );
    }
    
    /**
     * @dev Cancel a listing and return tokens to seller
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        
        require(listing.seller == msg.sender, "Not listing owner");
        require(listing.isActive, "Listing not active");
        
        uint256 remainingAmount = listing.amount;
        listing.isActive = false;
        listing.amount = 0;
        
        // Return tokens to seller
        require(
            carbonToken.transfer(msg.sender, remainingAmount),
            "Token transfer failed"
        );
        
        emit ListingCancelled(listingId, msg.sender);
    }
    
    /**
     * @dev Update listing price
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) 
        external 
    {
        Listing storage listing = listings[listingId];
        
        require(listing.seller == msg.sender, "Not listing owner");
        require(listing.isActive, "Listing not active");
        require(newPrice > 0, "Price must be greater than 0");
        
        listing.pricePerCredit = newPrice;
        
        emit ListingUpdated(listingId, listing.amount, newPrice);
    }
    
    /**
     * @dev Get all active listings
     */
    function getActiveListings() external view returns (Listing[] memory) {
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active listings
        Listing[] memory activeListings = new Listing[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].isActive) {
                activeListings[index] = listings[i];
                index++;
            }
        }
        
        return activeListings;
    }
    
    /**
     * @dev Get user's listings
     */
    function getUserListings(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userListings[user];
    }
    
    /**
     * @dev Get user's trade history
     */
    function getUserTrades(address user) 
        external 
        view 
        returns (Trade[] memory) 
    {
        return userTrades[user];
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high (max 5%)");
        uint256 oldFee = platformFee;
        platformFee = newFee;
        
        emit PlatformFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Withdraw accumulated fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get marketplace statistics
     */
    function getMarketplaceStats() 
        external 
        view 
        returns (
            uint256 _totalListings,
            uint256 _totalVolume,
            uint256 _totalTrades,
            uint256 _platformFee
        ) 
    {
        return (nextListingId, totalVolume, totalTrades, platformFee);
    }
}
