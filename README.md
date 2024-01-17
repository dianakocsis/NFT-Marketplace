# NFT Marketplace

The final project is an NFT marketplace that allows NFT owners to list their digital assets for sale. Key features include:

1. ERC721 Standard Compliance: Only NFTs following the ERC721 standard can be listed, ensuring compatibility and standardization.

2. Seller-Controlled Listings: Sellers have the authority to set and modify the price and duration of their listings. They can also cancel active listings at their discretion.

3. Purchase Mechanics: Buyers can purchase listed ERC721 tokens using ETH. The transaction requires the exact amount of ETH for the NFT to be transferred to the buyer.

4. Platform Fee and Royalties: A portion of the sale is allocated as a platform fee to the recipient designated by the marketplace owner. Additionally, if the NFT adheres to the NFT royalty standard (IERC2981), royalties are distributed to the royalty fee recipient mentioned in the contract. Consequently, the seller receives a net amount post these deductions.

5. Marketplace Display: The platform showcases all active and inactive listings, providing a comprehensive view of the marketplace's offerings.

This marketplace is designed to be a user-friendly platform for trading NFTs, with transparent processes for listing, buying, and understanding the financial dynamics of each transaction.

## Code Coverage Report

------------------|----------|----------|----------|----------|----------------|
File | % Stmts | % Branch | % Funcs | % Lines |Uncovered Lines |
------------------|----------|----------|----------|----------|----------------|
contracts/ | 100 | 94.83 | 100 | 96.94 | |
Marketplace.sol | 100 | 94.83 | 100 | 96.94 | 203,210,215 |
contracts/test/ | 100 | 100 | 100 | 100 | |
ERC20Test.sol | 100 | 100 | 100 | 100 | |
ERC721Test.sol | 100 | 100 | 100 | 100 | |
------------------|----------|----------|----------|----------|----------------|
All files | 100 | 94.83 | 100 | 97 | |
------------------|----------|----------|----------|----------|----------------|

## Testnet Deploy Information

| Contract    | Address Etherscan Link                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| Marketplace | `https://sepolia.basescan.org/address/0xe951f93b443c2af9c1b3ff94129d86d77fbfce64` |
| ERC721Test  | `https://sepolia.basescan.org/address/0xbf6e61bd36c8ba7a39dfca4a2c1d698c54e94076` |
