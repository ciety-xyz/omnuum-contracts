// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './OmnuumNFT1155.sol';

contract OmnuumMintManager is OwnableUpgradeable {
    uint8 public constant rateDecimal = 5;
    uint256 public feeRate; // 1 == 0.001%

    event SetFee(uint256 feeRate);
    event Airdrop(address indexed Contract, uint256 count);

    function initialize(uint256 _feeRate) public initializer {
        __Ownable_init();
        feeRate = _feeRate;
    }

    function setFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 100000, 'NE1');
        feeRate = _feeRate;
        emit SetFee(feeRate);
    }

    // mint to multiple address ex) airdrop
    function mintMultiple(
        address nftContract,
        address[] calldata _tos,
        uint16[] calldata _quantitys
    ) external {
        OmnuumNFT1155 targetContract = OmnuumNFT1155(nftContract);

        uint256 len = _tos.length;

        require(targetContract.owner() == msg.sender, 'OO1');
        require(len == _quantitys.length, 'ARG1');

        for (uint256 i; i < len; i++) {
            targetContract.mintDirect(_tos[i], _quantitys[i]);
        }
        emit Airdrop(nftContract, _tos.length);
    }
}
