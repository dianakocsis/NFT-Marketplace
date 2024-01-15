// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Marketplace is Ownable {

    uint256 public constant MAX_BPS = 10_000;

    enum Status {
        Nonexistent,
        Active,
        Expired,
        Sold,
        Canceled
    }

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        uint256 price;
        uint256 startTime;
        uint256 closingTime;
        address seller;
        address assetContract;
        bool sold;
        bool canceled;
    }

    mapping(uint256 => Listing) public listings;

    uint256 public nextListingId = 1;
    uint256 public platformFeeBps;
    address public platformFeeRecipient;

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

    modifier onlySeller(uint256 _listingId) {
        if (listings[_listingId].seller != msg.sender) {
            revert OnlySeller();
        }
        _;
    }

    modifier onlyActiveListing(uint256 _listingId) {
        if (getListingStatus(_listingId) != Status.Active) {
            revert ListingNotActive(_listingId);
        }
        _;
    }

    constructor(address _owner, uint256 _platformFeeBps, address _platformFeeRecipient) Ownable(_owner) {
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;
    }

    function createListing(address _assetContract, uint256 _tokenId, uint256 _price, uint256 _duration) external payable returns (uint256 listingId) {
        if (!_isERC721(_assetContract)) {
            revert NotERC721(_assetContract);
        }

        listingId = nextListingId++;
        uint256 closingTime = block.timestamp + _duration;

        uint256 startTime = block.timestamp;

       if (IERC721(_assetContract).ownerOf(_tokenId) != msg.sender) {
            revert NotTheOwner(msg.sender);
       }

       if (IERC721(_assetContract).getApproved(_tokenId) != address(this) ||
                IERC721(_assetContract).isApprovedForAll(msg.sender, address(this))) {
             revert MarketNotApproved();
       }

        Listing memory listing = Listing({
            listingId: listingId,
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

        emit ListingCreated(listingId);
    }

    function updatePrice(uint256 _listingId, uint256 _newPrice) external onlySeller(_listingId) onlyActiveListing(_listingId) {
        Listing storage listing = listings[_listingId];
        listing.price = _newPrice;
        emit PriceUpdated(_listingId, _newPrice);
    }

    function updateClosingTime(uint256 _listingId, uint256 _newClosingTime) external onlySeller(_listingId) onlyActiveListing(_listingId) {
        Listing storage listing = listings[_listingId];
        listing.closingTime = _newClosingTime;
        emit ClosingTimeUpdated(_listingId, _newClosingTime);
    }

    function cancelListing(uint256 _listingId) external onlySeller(_listingId) onlyActiveListing(_listingId) {
        listings[_listingId].canceled = true;
        emit ListingCanceled(_listingId);
    }

    function buy(uint256 _listingId) external payable onlyActiveListing(_listingId) {
        Listing storage listing = listings[_listingId];
        if (msg.value != listing.price) {
            revert IncorrectPurchaseAmount(listing.price, msg.value);
        }
        listing.sold = true;
        uint256 platformFeeCut = msg.value * platformFeeBps / MAX_BPS;
        (bool sent, ) = platformFeeRecipient.call{value: platformFeeCut}("");
        if (!sent) {
            revert FailedToTransferEth();
        }
        (bool success,) = listing.seller.call{value: msg.value - platformFeeCut}("");
        if (!success) {
            revert FailedToTransferEth();
        }

        emit PurchaseSuccessful(_listingId);
    }

    function setPlatformFeeRecipient(
        address _platformFeeRecipient
    ) external onlyOwner {

        platformFeeRecipient = _platformFeeRecipient;

        emit PlatformFeeRecipientUpdated(_platformFeeRecipient);
    }

    function setPlatformFeeBps(
        uint256 _platformFeeBps
    ) external onlyOwner {

        if (_platformFeeBps > MAX_BPS) {
            revert InvalidBps(_platformFeeBps);
        }

        platformFeeBps = _platformFeeBps;

        emit PlatformFeeBpsUpdated(_platformFeeBps);
    }

    function getListingStatus(uint256 _listingId) public view returns (Status) {
        Listing storage listing = listings[_listingId];
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

    function _isERC721(address _assetContract) internal view returns (bool) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool) {
            return true;
        } catch {
            return false;
        }
    }
}
