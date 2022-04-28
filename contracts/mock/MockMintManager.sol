// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import './GasNFT.sol';

contract MockMintManager {
    function airdrop(
        address _target,
        address[] calldata _tos,
        uint32[] calldata _quantitys
    ) public {
        uint256 len = _tos.length;
        for (uint32 i = 0; i < len; i++) {
            GasNFT(_target).mint(_tos[i], _quantitys[i]);
        }
    }
}
