// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Test is ERC721 {
    uint256 public tokenId = 1;
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function mint() external {
        _mint(msg.sender, tokenId++);
    }
}