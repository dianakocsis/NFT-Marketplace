import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  Marketplace__factory,
  Marketplace,
  ERC20Test__factory,
  ERC20Test,
  ERC721Test__factory,
  ERC721Test,
} from '../typechain-types';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('Marketplace', function () {
  let Marketplace: Marketplace__factory;
  let marketplace: Marketplace;
  let ERC20Test: ERC20Test__factory;
  let erc20Test: ERC20Test;
  let ERC721Test: ERC721Test__factory;
  let erc721Test: ERC721Test;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let platformFeeRecipient: SignerWithAddress;

  const eth = (count: string) => ethers.parseUnits(count, 18);

  this.beforeEach(async function () {
    [owner, platformFeeRecipient, addr1] = await ethers.getSigners();
    Marketplace = (await ethers.getContractFactory(
      'Marketplace'
    )) as Marketplace__factory;
    marketplace = (await Marketplace.deploy(
      owner,
      1000,
      platformFeeRecipient
    )) as Marketplace;
    await marketplace.waitForDeployment();

    ERC20Test = (await ethers.getContractFactory(
      'ERC20Test'
    )) as ERC20Test__factory;
    erc20Test = (await ERC20Test.deploy('ERC20Test', 'FT')) as ERC20Test;
    await erc20Test.waitForDeployment();

    ERC721Test = (await ethers.getContractFactory(
      'ERC721Test'
    )) as ERC721Test__factory;
    erc721Test = (await ERC721Test.deploy('ERC721Test', 'NFT')) as ERC721Test;
    await erc721Test.waitForDeployment();
  });

  describe('Create Listing', function () {
    it('Cannot creating listing for non-erc721', async function () {
      let sevenDays = 60 * 60 * 24 * 7;
      await expect(
        marketplace.createListing(erc20Test.target, 1, eth('0.01'), sevenDays, {
          value: eth('0.01'),
        })
      )
        .to.be.revertedWithCustomError(marketplace, 'NotERC721')
        .withArgs(erc20Test.target);
    });

    it('Need to be the owner', async function () {
      await erc721Test.connect(addr1).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await expect(
        marketplace.createListing(
          erc721Test.target,
          1,
          eth('0.01'),
          sevenDays,
          { value: eth('0.01') }
        )
      )
        .to.be.revertedWithCustomError(marketplace, 'NotTheOwner')
        .withArgs(owner.address);
    });

    it('Need to approve the market before listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await expect(
        marketplace.createListing(
          erc721Test.target,
          1,
          eth('0.01'),
          sevenDays,
          { value: eth('0.01') }
        )
      ).to.be.revertedWithCustomError(marketplace, 'MarketNotApproved');
    });

    it('Creates the listing', async function () {
      expect(await marketplace.getListingStatus(1)).to.equal(0);
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      let listing = await marketplace.listings(1);
      expect(listing.listingId).to.equal(1);
      expect(listing.tokenId).to.equal(1);
      expect(listing.price).to.equal(eth('0.01'));
      expect(listing.startTime).to.equal(await time.latest());
      expect(listing.seller).to.equal(owner);
      expect(listing.assetContract).to.equal(erc721Test.target);
      expect(listing.sold).to.equal(false);
      expect(listing.canceled).to.equal(false);
      expect(await marketplace.getListingStatus(1)).to.equal(1);
    });

    it('Emits create listing event', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await erc721Test.approve(marketplace.target, 1);
      const tx = await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        {
          value: eth('0.01'),
        }
      );
      await expect(tx).to.emit(marketplace, 'ListingCreated').withArgs(1);
    });
  });

  describe('Cancel Listing', function () {
    it('Can only cancel listing if seller', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );

      await expect(
        marketplace.connect(addr1).cancelListing(1)
      ).to.be.revertedWithCustomError(marketplace, 'OnlySeller');
    });

    it('Can only cancel active listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );

      await marketplace.cancelListing(1);

      await expect(marketplace.cancelListing(1))
        .to.be.revertedWithCustomError(marketplace, 'ListingNotActive')
        .withArgs(1);
    });

    it('Status updated', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );

      await marketplace.cancelListing(1);
      let listing = await marketplace.listings(1);
      expect(listing.canceled).to.equal(true);
      expect(await marketplace.getListingStatus(1)).to.equal(4);
    });

    it('Listing Canceled Event emitted', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );

      const tx = await marketplace.cancelListing(1);
      await expect(tx).to.emit(marketplace, 'ListingCanceled').withArgs(1);
    });
  });

  describe('Updates', function () {
    it('Cannot update price if not the seller', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await expect(
        marketplace.connect(addr1).updatePrice(1, eth('0.02'))
      ).to.be.revertedWithCustomError(marketplace, 'OnlySeller');
    });

    it('Cannot update price if not active listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.cancelListing(1);
      await expect(marketplace.updatePrice(1, eth('0.02')))
        .to.be.revertedWithCustomError(marketplace, 'ListingNotActive')
        .withArgs(1);
    });

    it('Price is updated correctly', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.updatePrice(1, eth('0.02'));
      let listing = await marketplace.listings(1);
      expect(listing.price).to.equal(eth('0.02'));
    });

    it('Price change event emitted', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      const tx = await marketplace.updatePrice(1, eth('0.02'));
      await expect(tx)
        .to.emit(marketplace, 'PriceUpdated')
        .withArgs(1, eth('0.02'));
    });

    it('Cannot update closing date if not the seller', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await expect(
        marketplace
          .connect(addr1)
          .updateClosingTime(1, (await time.latest()) + sevenDays)
      ).to.be.revertedWithCustomError(marketplace, 'OnlySeller');
    });

    it('Cannot update closing date if listing not active', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await network.provider.send('evm_increaseTime', [sevenDays]);
      await network.provider.send('evm_mine');
      await expect(
        marketplace.updateClosingTime(1, (await time.latest()) + sevenDays)
      )
        .to.be.revertedWithCustomError(marketplace, 'ListingNotActive')
        .withArgs(1);
    });

    it('Closing time is updated correctly', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      let tenDays = 60 * 60 * 24 * 10;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      let newEndTime = (await time.latest()) + tenDays;
      await marketplace.updateClosingTime(1, newEndTime);
      let listing = await marketplace.listings(1);
      expect(listing.closingTime).to.equal(newEndTime);
    });

    it('Closing time event emitted', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      let tenDays = 60 * 60 * 24 * 10;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      let newEndTime = (await time.latest()) + tenDays;
      const tx = await marketplace.updateClosingTime(1, newEndTime);
      await expect(tx)
        .to.emit(marketplace, 'ClosingTimeUpdated')
        .withArgs(1, newEndTime);
    });
  });

  describe('Buying', function () {
    it('Can only buy from an active listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.cancelListing(1);
      await expect(marketplace.buy(1, { value: eth('0.01') }))
        .to.be.revertedWithCustomError(marketplace, 'ListingNotActive')
        .withArgs(1);
    });

    it('Can only buy with proper amount', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await expect(marketplace.buy(1, { value: eth('0.02') }))
        .to.be.revertedWithCustomError(marketplace, 'IncorrectPurchaseAmount')
        .withArgs(eth('0.01'), eth('0.02'));
    });

    it('Listing updated when bought', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.buy(1, { value: eth('0.01') });
      let listing = await marketplace.listings(1);
      expect(listing.sold).to.equal(true);
      expect(await marketplace.getListingStatus(1)).to.equal(3);
    });

    it('Payment fee sent out properly', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      let feeRecipientBalanceBefore = await ethers.provider.getBalance(
        await marketplace.platformFeeRecipient()
      );
      let platformFeeCut =
        (eth('0.01') * (await marketplace.platformFeeBps())) /
        (await marketplace.MAX_BPS());
      await marketplace.buy(1, { value: eth('0.01') });
      let feeRecipientBalanceAfter = await ethers.provider.getBalance(
        await marketplace.platformFeeRecipient()
      );
      expect(feeRecipientBalanceAfter).to.equal(
        feeRecipientBalanceBefore + platformFeeCut
      );
    });

    it('Payment to seller sent out properly', async function () {
      await erc721Test.connect(addr1).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.connect(addr1).approve(marketplace.target, 1);
      await marketplace
        .connect(addr1)
        .createListing(erc721Test.target, 1, eth('0.01'), sevenDays, {
          value: eth('0.01'),
        });
      let listing = await marketplace.listings(1);
      let sellerBalanceBefore = await ethers.provider.getBalance(
        listing.seller
      );
      let platformFeeCut =
        (eth('0.01') * (await marketplace.platformFeeBps())) /
        (await marketplace.MAX_BPS());
      let amtToSeller = eth('0.01') - platformFeeCut;
      await marketplace.buy(1, { value: eth('0.01') });
      let sellerBalanceAfter = await ethers.provider.getBalance(listing.seller);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + amtToSeller);
    });

    it('Purchased event emitted', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      const tx = await marketplace.buy(1, { value: eth('0.01') });
      await expect(tx).to.emit(marketplace, 'PurchaseSuccessful').withArgs(1);
    });
  });

  describe('Updating Platform Fee and Recipient', function () {
    it('Only owner can update platform fee recipient', async function () {
      await expect(
        marketplace.connect(addr1).setPlatformFeeRecipient(addr1.address)
      )
        .to.be.revertedWithCustomError(
          marketplace,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(addr1);
    });

    it('Only owner can update platform fee', async function () {
      await expect(marketplace.connect(addr1).setPlatformFeeBps(0))
        .to.be.revertedWithCustomError(
          marketplace,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(addr1);
    });

    it('platform fee recipient gets updated correctly', async function () {
      await marketplace.setPlatformFeeRecipient(addr1.address);
      expect(await marketplace.platformFeeRecipient()).to.equal(addr1.address);
    });

    it('platform fee recipient updated event gets emitted', async function () {
      const tx = await marketplace.setPlatformFeeRecipient(addr1.address);
      await expect(tx)
        .to.emit(marketplace, 'PlatformFeeRecipientUpdated')
        .withArgs(addr1.address);
    });

    it('cannot update platform fee bps more than max', async function () {
      await expect(marketplace.setPlatformFeeBps(11000))
        .to.be.revertedWithCustomError(marketplace, 'InvalidBps')
        .withArgs(11000);
    });

    it('platform fee bps gets updated correctly', async function () {
      await marketplace.setPlatformFeeBps(5000);
      expect(await marketplace.platformFeeBps()).to.equal(5000);
    });

    it('platform fee bps updated event gets emitted', async function () {
      const tx = await marketplace.setPlatformFeeBps(5000);
      await expect(tx)
        .to.emit(marketplace, 'PlatformFeeBpsUpdated')
        .withArgs(5000);
    });
  });

  describe('Views', function () {
    it('Total listings', async function () {
      expect(await marketplace.getTotalListings()).to.equal(0);
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      expect(await marketplace.getTotalListings()).to.equal(1);
    });

    it('Get all listings', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.cancelListing(1);
      let allListings = await marketplace.getAllListings();
      expect(allListings).to.deep.equal([await marketplace.listings(1)]);
    });

    it('Get all active listings', async function () {
      await erc721Test.connect(owner).mint();
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;

      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(
        erc721Test.target,
        1,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await erc721Test.approve(marketplace.target, 2);
      await marketplace.createListing(
        erc721Test.target,
        2,
        eth('0.01'),
        sevenDays,
        { value: eth('0.01') }
      );
      await marketplace.cancelListing(1);
      let allListings = await marketplace.getAllActiveListings();
      expect(allListings).to.deep.equal([await marketplace.listings(2)]);
    });
  });
});
