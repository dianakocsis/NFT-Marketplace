import hre, { ethers } from 'hardhat';
import {
  Marketplace__factory,
  Marketplace,
  ERC20Test__factory,
  ERC20Test,
  ERC721Test__factory,
  ERC721Test,
} from '../typechain-types';

async function main() {
  const [owner, platformFeeRecipient, royaltyReceiver] =
    await ethers.getSigners();

  const Marketplace = (await ethers.getContractFactory(
    'Marketplace'
  )) as Marketplace__factory;
  const marketplace = (await Marketplace.deploy(
    owner,
    1000,
    platformFeeRecipient
  )) as Marketplace;
  await marketplace.waitForDeployment();

  const ERC20Test = (await ethers.getContractFactory(
    'ERC20Test'
  )) as ERC20Test__factory;
  const erc20Test = (await ERC20Test.deploy('ERC20Test', 'FT')) as ERC20Test;
  await erc20Test.waitForDeployment();

  const ERC721Test = (await ethers.getContractFactory(
    'ERC721Test'
  )) as ERC721Test__factory;
  const erc721Test = (await ERC721Test.deploy(
    'ERC721Test',
    'NFT',
    royaltyReceiver,
    1000
  )) as ERC721Test;
  await erc721Test.waitForDeployment();

  await erc721Test.deploymentTransaction()?.wait(5);

  await hre.run('verify:verify', {
    address: marketplace.target,
    constructorArguments: [owner, 1000, platformFeeRecipient],
  });

  await hre.run('verify:verify', {
    address: erc20Test.target,
    constructorArguments: ['ERC20Test', 'FT'],
  });

  await hre.run('verify:verify', {
    address: erc721Test.target,
    constructorArguments: ['ERC721Test', 'NFT', royaltyReceiver, 1000],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
