// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './OmnuumNFT1155.sol';

contract OmnuumMintManager is OwnableUpgradeable {
    uint8 public constant rateDecimal = 5;
    uint256 public baseFeeRate;
    mapping(address => uint256) public discountRate;

    event ChangeBaseFeeRate(uint256 baseFeeRate);
    event SetDiscountRate(address nftContract, uint256 discountFeeRate);
    event Airdrop(address indexed Contract, uint256 count);
    event SetSchedule(address indexed nft, uint256 indexed groupId);
    event PublicMint(address indexed nft, address indexed minter, uint256 indexed groupId, uint32 quantity);

    struct PublicMintSchedule {
        uint32 supply;
        uint32 mintedTotal;
        uint32 maxMintAtAddress;
        mapping(address => uint32) minted;
        uint256 endDate;
        uint256 basePrice;
    }

    // nft => groupId => PublicMintSchedule
    mapping(address => mapping(uint256 => PublicMintSchedule)) public publicMintSchedules;

    function initialize(uint256 _baseFeeRate) public initializer {
        __Ownable_init();
        baseFeeRate = _baseFeeRate;
    }

    function changeBaseFeeRate(uint256 _newBaseFeeRate) external onlyOwner {
        require(_newBaseFeeRate <= 100000, 'NE1');
        baseFeeRate = _newBaseFeeRate;
        emit ChangeBaseFeeRate(_newBaseFeeRate);
    }

    function setDiscountRate(address _nftContract, uint256 _discountRate) external onlyOwner {
        require(_discountRate <= 100000, 'NE1');
        discountRate[_nftContract] = _discountRate;
        emit SetDiscountRate(_nftContract, _discountRate);
    }

    function setPublicMintSchedule(
        address _nft,
        uint256 _groupId,
        uint256 _endDate,
        uint256 _basePrice,
        uint32 _supply,
        uint32 _maxMintAtAddress
    ) public {
        require(Ownable(_nft).owner() == msg.sender, 'OO1');

        PublicMintSchedule storage schedule = publicMintSchedules[_nft][_groupId];

        schedule.supply = _supply;
        schedule.endDate = _endDate;
        schedule.basePrice = _basePrice;
        schedule.maxMintAtAddress = _maxMintAtAddress;

        emit SetSchedule(_nft, _groupId);
    }

    function publicMint(
        uint16 _groupId,
        uint32 _quantity,
        uint256 value,
        address _minter
    ) public {
        PublicMintSchedule storage schedule = publicMintSchedules[msg.sender][_groupId];

        require(block.timestamp <= schedule.endDate, 'MT8');
        require(schedule.basePrice * _quantity <= value, 'MT5');
        require(schedule.minted[_minter] + _quantity <= schedule.maxMintAtAddress, 'MT2');
        require(schedule.mintedTotal + _quantity <= schedule.supply, 'MT3');

        schedule.minted[_minter] += _quantity;
        schedule.mintedTotal += _quantity;

        emit PublicMint(msg.sender, _minter, _groupId, _quantity);
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
