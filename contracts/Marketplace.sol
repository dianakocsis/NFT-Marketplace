// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @title Marketplace
/// @notice A marketplace for ERC721 tokens
contract Marketplace is Ownable {

    uint256 public constant MAX_BPS = 10_000;
    uint256 public nextListingId = 1;
    uint256 public platformFeeBps;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) private hashToId;
    address public platformFeeRecipient;

    struct Listing {
        uint256 tokenId;
        uint256 price;
        uint256 startTime;
        uint256 closingTime;
        address seller;
        address assetContract;
        bool sold;
        bool canceled;
    }

    enum Status {
        Nonexistent,
        Active,
        Canceled,
        Expired,
        Sold
    }

    event ListingCreated(uint256 listingId);
    event ListingCanceled(uint256 listingId);
    event PurchaseSuccessful(uint256 listingId);
    event PriceUpdated(uint256 listingId, uint256 newPrice);
    event ClosingTimeUpdated(uint256 listingId, uint256 newclosingTime);
    event PlatformFeeRecipientUpdated(address indexed newRecipient);
    event PlatformFeeBpsUpdated(uint256 newBps);

    error OnlySeller();
    error ListingNotActive(uint256 listingId);
    error NotERC721(address asset);
    error NotTheOwner(address creator);
    error MarketNotApproved();
    error ListingExpired(uint256 listingId);
    error CannotChangeToken(address expectedAsset, uint256 expectedId, address newAsset, uint256 newId);
    error IncorrectPurchaseAmount(uint256 correctAmount, uint256 attemptedAmount);
    error FailedToTransferEth();
    error InvalidBps(uint256 invalidAmount);
    error ListingAlreadyActive(uint256 listingId);
    error FeesExceedPrice();

    /// @notice Creates a new marketplace
    /// @param _owner The owner of the marketplace
    /// @param _platformFeeBps The platform fee in basis points
    /// @param _platformFeeRecipient The address that will receive the platform fee
    constructor(address _owner, uint256 _platformFeeBps, address _platformFeeRecipient) Ownable(_owner) {
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;
    }

    /// @notice Checks if the caller is the seller of the listing
    /// @param _listingId The id of the listing
    modifier onlySeller(uint256 _listingId) {
        if (listings[_listingId].seller != msg.sender) {
            revert OnlySeller();
        }
        _;
    }

    /// @notice Checks if the listing is active
    /// @param _listingId The id of the listing
    modifier onlyActiveListing(uint256 _listingId) {
        if (getListingStatus(_listingId) != Status.Active) {
            revert ListingNotActive(_listingId);
        }
        _;
    }

    /// @notice Creates a new listing
    /// @param _assetContract The address of the ERC721 contract
    /// @param _tokenId The id of the token
    /// @param _price The price of the token
    /// @param _duration The duration of the listing
    /// @return listingId The id of the listing
    function createListing(
        address _assetContract,
        uint256 _tokenId,
        uint256 _price,
        uint256 _duration
    )
        external
        returns (uint256 listingId)
    {
        if (!_isERC721(_assetContract)) {
            revert NotERC721(_assetContract);
        }

        listingId = nextListingId++;
        uint256 h = _getHash(_assetContract, _tokenId);
        uint256 id = hashToId[h];
        if (id != 0) {
            if (getListingStatus(id) == Status.Active) {
                revert ListingAlreadyActive(id);
            }
        }
        uint256 closingTime = block.timestamp + _duration;
        uint256 startTime = block.timestamp;

        _validateListing(_assetContract, _tokenId, msg.sender);

        Listing memory listing = Listing({
            tokenId: _tokenId,
            price: _price,
            startTime: startTime,
            closingTime: closingTime,
            seller: msg.sender,
            assetContract: _assetContract,
            sold: false,
            canceled: false
        });

        listings[listingId] = listing;
        hashToId[h] = listingId;

        emit ListingCreated(listingId);
    }

    /// @notice Updates the price of a listing
    /// @param _listingId The id of the listing
    /// @param _newPrice The new price of the listing
    function updatePrice(
        uint256 _listingId,
        uint256 _newPrice
    )
        external
        onlySeller(_listingId)
        onlyActiveListing(_listingId)
    {
        Listing storage listing = listings[_listingId];
        _validateListing(listing.assetContract, listing.tokenId, msg.sender);
        listing.price = _newPrice;
        emit PriceUpdated(_listingId, _newPrice);
    }

    /// @notice Updates the closing time of a listing
    /// @param _listingId The id of the listing
    /// @param _newClosingTime The new closing time of the listing
    function updateClosingTime(
        uint256 _listingId,
        uint256 _newClosingTime
    )
        external
        onlySeller(_listingId)
        onlyActiveListing(_listingId)
    {
        Listing storage listing = listings[_listingId];
        _validateListing(listing.assetContract, listing.tokenId, msg.sender);
        listing.closingTime = _newClosingTime;
        emit ClosingTimeUpdated(_listingId, _newClosingTime);
    }

    /// @notice Cancels a listing
    /// @param _listingId The id of the listing
    function cancelListing(uint256 _listingId) external onlySeller(_listingId) onlyActiveListing(_listingId) {
        listings[_listingId].canceled = true;
        emit ListingCanceled(_listingId);
    }

    /// @notice Purchases a listing
    /// @param _listingId The id of the listing
    function buy(uint256 _listingId) external payable onlyActiveListing(_listingId) {
        Listing storage listing = listings[_listingId];
        _validateListing(listing.assetContract, listing.tokenId, listing.seller);
        if (msg.value != listing.price) {
            revert IncorrectPurchaseAmount(listing.price, msg.value);
        }
        listing.sold = true;
        emit PurchaseSuccessful(_listingId);

        uint256 platformFeeCut = msg.value * platformFeeBps / MAX_BPS;

        address royaltyRecipient;
        uint256 royaltyAmount;

        try IERC2981(listing.assetContract).royaltyInfo(listing.tokenId, msg.value) returns (
            address royaltyFeeRecipient, uint256 royaltyFeeAmount
        ) {
            if (royaltyFeeRecipient != address(0) && royaltyFeeAmount > 0) {
                if (royaltyFeeAmount + platformFeeCut > msg.value) {
                    revert FeesExceedPrice();
                }
                royaltyRecipient = royaltyFeeRecipient;
                royaltyAmount = royaltyFeeAmount;
                (bool success, ) = royaltyFeeRecipient.call{value: royaltyFeeAmount}("");
                if (!success) {
                    revert FailedToTransferEth();
                }
            }
        } catch {}

        (bool sent, ) = platformFeeRecipient.call{value: platformFeeCut}("");
        if (!sent) {
            revert FailedToTransferEth();
        }

        (sent,) = listing.seller.call{value: msg.value - platformFeeCut - royaltyAmount}("");
        if (!sent) {
            revert FailedToTransferEth();
        }

        IERC721(listing.assetContract).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);
    }

    /// @notice Updates the platform fee recipient
    /// @param _platformFeeRecipient The new platform fee recipient
    function updatePlatformFeeRecipient(address _platformFeeRecipient) external onlyOwner {
        platformFeeRecipient = _platformFeeRecipient;
        emit PlatformFeeRecipientUpdated(_platformFeeRecipient);
    }

    /// @notice Updates the platform fee basis points
    /// @param _platformFeeBps The new platform fee basis points
    function updatePlatformFeeBps(uint256 _platformFeeBps) external onlyOwner {
        if (_platformFeeBps > MAX_BPS) {
            revert InvalidBps(_platformFeeBps);
        }

        platformFeeBps = _platformFeeBps;
        emit PlatformFeeBpsUpdated(_platformFeeBps);
    }

    /// @notice Gets all active listings
    /// @return The active listings
    function getAllActiveListings() external view returns (Listing[] memory) {
        uint256 activeListingsLength = getTotalActiveListings();
        Listing[] memory activeListings = new Listing[](activeListingsLength);
        Listing[] memory allListings = new Listing[](nextListingId - 1);
        uint256 cursor = 0;
        for (uint256 i = 0; i < allListings.length; ++i) {
            if (getListingStatus(i+1) == Status.Active) {
                activeListings[cursor] = listings[i+1];
                cursor++;
            }
        }
        return activeListings;
    }

    /// @notice Gets all listings
    /// @return The listings
    function getAllListings() external view returns (Listing[] memory) {
        Listing[] memory allListings = new Listing[](nextListingId - 1);
        for (uint256 i = 0; i < allListings.length; ++i) {
            allListings[i] = listings[i+1];
        }
        return allListings;
    }

    /// @notice Gets the total number of listings
    /// @return totalListings The total number of listings
    function getTotalListings() view external returns (uint256) {
        return nextListingId - 1;
    }

    /// @notice Gets the total number of active listings
    /// @return The total number of active listings
    function getTotalActiveListings() public view returns (uint256) {
        uint256 result = 0;
        for (uint256 i = 0; i < nextListingId - 1; ++i) {
            if (getListingStatus(i+1) == Status.Active) {
                result++;
            }
        }
        return result;
    }

    /// @notice Gets the status of a listing
    /// @param _listingId The id of the listing
    /// @return The status of the listing
    function getListingStatus(uint256 _listingId) public view returns (Status) {
        Listing memory listing = listings[_listingId];
        if (listing.startTime == 0) {
            return Status.Nonexistent;
        } else if (listing.sold) {
            return Status.Sold;
        } else if (listing.canceled) {
            return Status.Canceled;
        } else if (listing.closingTime <= block.timestamp) {
            return Status.Expired;
        } else {
            return Status.Active;
        }
    }

    /// @notice Checks if an asset is an ERC721
    /// @param _assetContract The address of the asset
    /// @return Whether or not the asset is an ERC721
    function _isERC721(address _assetContract) internal view returns (bool) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool) {
            return true;
        } catch {
            return false;
        }
    }

    /// @notice Validates a listing if the owner of the token is the seller and if the marketplace is approved
    /// @param _assetContract The address of the asset
    /// @param _tokenId The id of the token
    /// @param _owner The owner of the token
    function _validateListing(address _assetContract, uint256 _tokenId, address _owner) internal view {
        if (IERC721(_assetContract).ownerOf(_tokenId) != _owner) {
            revert NotTheOwner(_owner);
       }

       if (IERC721(_assetContract).getApproved(_tokenId) != address(this) &&
            !IERC721(_assetContract).isApprovedForAll(msg.sender, address(this))) {
            revert MarketNotApproved();
       }
    }

    /// @notice Gets the hash of an asset and token id
    /// @param _assetContract The address of the asset
    /// @param _tokenId The id of the token
    /// @return The hash of the asset and token id
    function _getHash(address _assetContract, uint256 _tokenId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(_assetContract, _tokenId)));
    }
}
