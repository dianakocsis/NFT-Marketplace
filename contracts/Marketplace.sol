// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract Marketplace {

    enum Status {
        UNSET,
        CREATED,
        COMPLETED,
        CANCELLED
    }

    struct ListingParameters {
        address assetContract;
        uint256 tokenId;
        uint256 price;
        uint256 endTimestamp;
    }

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        uint256 price;
        uint256 startTimestamp;
        uint256 endTimestamp;
        address seller;
        address assetContract;
        Status status;
    }

    mapping(uint256 => Listing) public listings;

    uint256 public nextListingId = 1;
    uint256 platformFeeBps;
    address platformFeeRecipient;

    event ListingCreated(uint256 listingId);
    event ListingCanceled(uint256 listingId);
    event ListingUpdated(uint256 listingId);
    event ListingBought(uint256 listingId);

    error OnlySeller();
    error ListingNotActive(uint256 listingId);
    error NotERC721(address asset);
    error NotTheOwner(address creator);
    error MarketNotApproved();
    error ListingExpired(uint256 listingId);
    error CannotChangeToken(address expectedAsset, uint256 expectedId, address newAsset, uint256 newId);
    error IncorrectAmount(uint256 correctAmount, uint256 attemptedAmount);
    error InvalidEndTime(uint256 endTime);

    modifier onlySeller(uint256 _listingId) {
        if (listings[_listingId].seller != msg.sender) {
            revert OnlySeller();
        }
        _;
    }

    modifier onlyActiveListing(uint256 _listingId) {
        if (listings[_listingId].status != Status.CREATED) {
            revert ListingNotActive(_listingId);
        }
        _;
    }

    // constructor(uint256 _platformFeeBps, address _platformFeeRecipient) {
    //     platformFeeBps = _platformFeeBps;
    //     platformFeeRecipient = _platformFeeRecipient;
    // }

    function createListing(ListingParameters calldata _params) external payable returns (uint256 listingId) {
        if (!_isERC721(_params.assetContract)) {
            revert NotERC721(_params.assetContract);
        }

        listingId = nextListingId++;

        if (_params.endTimestamp <= block.timestamp) {
            revert InvalidEndTime(_params.endTimestamp);
        }

        uint256 startTime = block.timestamp;

       if (IERC721(_params.assetContract).ownerOf(_params.tokenId) != msg.sender) {
            revert NotTheOwner(msg.sender);
       }

       if (IERC721(_params.assetContract).getApproved(_params.tokenId) != address(this) ||
                IERC721(_params.assetContract).isApprovedForAll(msg.sender, address(this))) {
             revert MarketNotApproved(); // market does not have approval to transfer nfts
       }

        Listing memory listing = Listing({
            listingId: listingId,
            tokenId: _params.tokenId,
            price: _params.price,
            startTimestamp: startTime,
            endTimestamp: _params.endTimestamp,
            seller: msg.sender,
            assetContract: _params.assetContract,
            status: Status.CREATED
        });

        listings[listingId] = listing;

        emit ListingCreated(listingId);
    }

    function _isERC721(address _assetContract) internal view returns (bool) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool) {
            return true;
        } catch {
            return false;
        }
    }
}
