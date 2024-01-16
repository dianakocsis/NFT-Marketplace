// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";

contract ERC721Test is ERC721Royalty {
    uint256 public tokenId = 1;
    constructor(string memory _name, string memory _symbol, address _receiver, uint96 _feeNumerator) ERC721(_name, _symbol) {
        _setDefaultRoyalty(_receiver, _feeNumerator);
    }

    function mint() external {
        _mint(msg.sender, tokenId++);
    }
}