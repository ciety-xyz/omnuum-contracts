// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './OmnuumNFT1155.sol';

contract OmnuumMintManager is OwnableUpgradeable {
    uint8 public constant rateDecimal = 5;
    uint256 public baseFeeRate;
    uint256 public minFee;
    mapping(address => uint256) public discountRate;

    event ChangeBaseFeeRate(uint256 baseFeeRate);
    event SetDiscountRate(address nftContract, uint256 discountFeeRate);

    event SetPublicSchedule(
        address indexed nft,
        uint256 indexed groupId,
        uint256 endDate,
        uint256 basePrice,
        uint32 supply,
        uint32 maxMintAtAddress
    );
    event PublicMint(
        address indexed nftContract,
        address indexed minter,
        uint256 indexed groupId,
        uint32 quantity,
        uint32 maxQuantity,
        uint256 price
    );

    event Airdrop(address indexed Contract, address indexed receiver, uint256 quantity);

    event SetMinFee(uint256 minFee);

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
        minFee = 0.0005 ether;
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

    function setMinFee(uint256 _minFee) public onlyOwner {
        minFee = _minFee;
        emit SetMinFee(_minFee);
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

        emit SetPublicSchedule(_nft, _groupId, _endDate, _basePrice, _supply, _maxMintAtAddress);
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

        emit PublicMint(msg.sender, _minter, _groupId, _quantity, schedule.supply, schedule.basePrice);
        //        emit PublicMint(msg.sender, _minter, _groupId, _quantity);
    }

    // mint to multiple address ex) airdrop
    function mintMultiple(
        address nftContract,
        address[] calldata _tos,
        uint16[] calldata _quantities
    ) public payable {
        OmnuumNFT1155 targetContract = OmnuumNFT1155(nftContract);

        uint256 len = _tos.length;

        require(targetContract.owner() == msg.sender, 'OO1');
        require(len == _quantities.length, 'ARG1');

        uint256 totalQuantity;
        for (uint256 i; i < len; i++) {
            totalQuantity += _quantities[i];
        }

        require(msg.value >= totalQuantity * minFee, 'MT5');

        for (uint256 i; i < len; i++) {
            address to = _tos[i];
            uint16 quantity = _quantities[i];
            targetContract.mintDirect{ value: minFee * _quantities[i] }(to, quantity);
            emit Airdrop(nftContract, to, quantity);
        }
    }
}
