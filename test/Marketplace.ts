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
  let addr2: SignerWithAddress;

  const tokens = (count: string) => ethers.parseUnits(count, 18);

  this.beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    Marketplace = (await ethers.getContractFactory(
      'Marketplace'
    )) as Marketplace__factory;
    marketplace = (await Marketplace.deploy()) as Marketplace;
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
      const params = {
        assetContract: erc20Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) + sevenDays,
      };
      await expect(marketplace.createListing(params, { value: tokens('0.01') }))
        .to.be.revertedWithCustomError(marketplace, 'NotERC721')
        .withArgs(erc20Test.target);
    });

    it('Cannot create listing with end date before the start date', async function () {
      let sevenDays = 60 * 60 * 24 * 7;
      const params = {
        assetContract: erc721Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) - sevenDays,
      };
      await expect(marketplace.createListing(params, { value: tokens('0.01') }))
        .to.be.revertedWithCustomError(marketplace, 'InvalidEndTime')
        .withArgs(params.endTimestamp);
    });

    it('Need to be the owner', async function () {
      await erc721Test.connect(addr1).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      const params = {
        assetContract: erc721Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) + sevenDays,
      };
      await expect(marketplace.createListing(params, { value: tokens('0.01') }))
        .to.be.revertedWithCustomError(marketplace, 'NotTheOwner')
        .withArgs(owner.address);
    });

    it('Need to approve the market before listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      const params = {
        assetContract: erc721Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) + sevenDays,
      };
      await expect(
        marketplace.createListing(params, { value: tokens('0.01') })
      ).to.be.revertedWithCustomError(marketplace, 'MarketNotApproved');
    });

    it('Creates the listing', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      const params = {
        assetContract: erc721Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) + sevenDays,
      };
      await erc721Test.approve(marketplace.target, 1);
      await marketplace.createListing(params, { value: tokens('0.01') });
      let listing = await marketplace.listings(1);
      expect(listing.listingId).to.equal(1);
      expect(listing.tokenId).to.equal(1);
      expect(listing.price).to.equal(tokens('0.01'));
      expect(listing.startTimestamp).to.equal(await time.latest());
      expect(listing.seller).to.equal(owner);
      expect(listing.assetContract).to.equal(erc721Test.target);
      expect(listing.status).to.equal(1);
    });

    it('Emits create listing event', async function () {
      await erc721Test.connect(owner).mint();
      let sevenDays = 60 * 60 * 24 * 7;
      const params = {
        assetContract: erc721Test.target,
        tokenId: 1,
        price: tokens('0.01'),
        endTimestamp: (await time.latest()) + sevenDays,
      };
      await erc721Test.approve(marketplace.target, 1);
      const tx = await marketplace.createListing(params, {
        value: tokens('0.01'),
      });
      await expect(tx).to.emit(marketplace, 'ListingCreated').withArgs(1);
    });
  });
});
