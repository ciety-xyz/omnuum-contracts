// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

contract GasNFT is ERC1155 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    event Airdrop(address indexed nft, address indexed to, uint32 quantity);

    constructor() ERC1155('') {}

    function mint(address _to, uint32 _quantity) public {
        for (uint32 i = 0; i < _quantity; i++) {
            _tokenIdCounter.increment();
            _mint(_to, _tokenIdCounter.current(), 1, '');
        }
    }

    function mintMultiple(address[] calldata _tos) public {
        uint256 len = _tos.length;
        for (uint32 i = 0; i < len; i++) {
            _tokenIdCounter.increment();
            _mint(_tos[i], _tokenIdCounter.current(), 1, '');
        }
    }

    function mintMultiple2(address[] calldata _tos, uint32[] calldata _quantitys) public {
        uint256 len = _tos.length;
        uint256 totalQuantity;
        for (uint256 i = 0; i < len; i++) {
            totalQuantity += _quantitys[i];
        }

        for (uint32 i = 0; i < len; i++) {
            address to = _tos[i];
            uint32 quantity = _quantitys[i];

            emit Airdrop(address(this), to, quantity);

            for (uint32 j = 0; j < quantity; j++) {
                _tokenIdCounter.increment();
                _mint(to, _tokenIdCounter.current(), 1, '');
            }
        }
    }
}
