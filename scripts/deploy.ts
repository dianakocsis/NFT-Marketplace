import { ethers } from 'hardhat';
import {
  Marketplace__factory,
  Marketplace,
  ERC20Test__factory,
  ERC20Test,
  ERC721Test__factory,
  ERC721Test,
} from '../typechain-types';

async function main() {
  const [owner] = await ethers.getSigners();
  console.log('owner is ', owner.address);
  const platformFeeRecipient = ethers.Wallet.createRandom();
  console.log('platform fee recipient is ', platformFeeRecipient.address);
  const royaltyReceiver = ethers.Wallet.createRandom();
  console.log('royalty receiver is ', royaltyReceiver.address);
  const Marketplace = (await ethers.getContractFactory(
    'Marketplace'
  )) as Marketplace__factory;
  const marketplace = (await Marketplace.deploy(
    owner.address,
    1000,
    platformFeeRecipient.address
  )) as Marketplace;
  await marketplace.waitForDeployment();

  console.log(`marketplace deployed to ${marketplace.target}`);

  const ERC20Test = (await ethers.getContractFactory(
    'ERC20Test'
  )) as ERC20Test__factory;
  const erc20Test = (await ERC20Test.deploy('ERC20Test', 'FT')) as ERC20Test;
  await erc20Test.waitForDeployment();

  console.log(`erc20test deployed to ${erc20Test.target}`);

  const ERC721Test = (await ethers.getContractFactory(
    'ERC721Test'
  )) as ERC721Test__factory;
  const erc721Test = (await ERC721Test.deploy(
    'ERC721Test',
    'NFT',
    royaltyReceiver.address,
    1000
  )) as ERC721Test;
  await erc721Test.waitForDeployment();

  console.log(`erc721test deployed to ${erc721Test.target}`);

  await erc721Test.deploymentTransaction()?.wait(5);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
