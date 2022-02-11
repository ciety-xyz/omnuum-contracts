// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './interfaces/ISenderVerifier.sol';
import './OmnuumMintManager.sol';
import './OmnuumCAManager.sol';
import './OmnuumTicketManager.sol';
import 'hardhat/console.sol';

contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager caManager;
    address omA;

    uint256 publicEndDate;
    uint256 public basePrice;
    uint32 public maxMintPerAddress;
    uint32 public publicMintMax;
    uint32 public maxSupply;
    uint32 public publicMintAmount;
    uint32 public nounce; // for public minting

    mapping(address => uint16) publicMintCnt;

    bool public mintEnd;
    bool isPublic;
    bool public isRevealed;

    string internal coverUri;

    // actionType: cover, base
    event UriChanged(string uri, string actionType);

    event Public(bool isPublic, uint256 basePrice, uint256 endDate, uint32 amount);

    function initialize(
        string calldata _uri,
        address _caManagerAddress,
        address _omA, // omnuum company wallet address
        uint32 _maxMintPerAddress,
        uint32 _maxSupply,
        string calldata _coverUri,
        address _prjOwner
    ) public initializer {
        __ERC1155_init(_uri);
        __ReentrancyGuard_init();
        __Ownable_init();

        maxSupply = _maxSupply;
        maxMintPerAddress = _maxMintPerAddress;

        omA = _omA;
        caManager = OmnuumCAManager(_caManagerAddress);
        coverUri = _coverUri;

        transferOwnership(_prjOwner);
    }

    function changePublicMint(
        bool _isPublic,
        uint256 _basePrice,
        uint256 _publicEndDate,
        uint32 _openAmount
    ) public onlyOwner {
        isPublic = _isPublic;
        basePrice = _basePrice;
        publicEndDate = _publicEndDate;
        publicMintMax = publicMintAmount + _openAmount; // current minted public + added free amount
        nounce++;

        emit Public(_isPublic, _basePrice, _publicEndDate, _openAmount);
    }

    function mint(
        address _to,
        uint16 _quantity,
        uint256 _price,
        uint32 _groupId,
        ISenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(!mintEnd, 'MT7');
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        require(msg.value >= _price * _quantity, 'MT5');

        if (isPublic && (_price == basePrice)) {
            require(publicEndDate > block.timestamp, 'MT8');
            require(publicMintAmount + _quantity <= publicMintMax, 'MT3');
            ISenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', nounce, _payload);
            // address 당 체크
            require(publicMintCnt[msg.sender] + _quantity <= maxMintPerAddress, 'MT2');
            publicMintCnt[msg.sender] += _quantity;
            publicMintAmount += _quantity;
        } else {
            ISenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'TICKET', _groupId, _payload);
            OmnuumTicketManager(caManager.getContract('TICKETMANAGER')).useTicket(msg.sender, _quantity, _price, _groupId);
        }

        mintLoop(_to, _quantity);

        OmnuumMintManager mintManager = OmnuumMintManager(caManager.getContract('MINTMANAGER'));
        uint256 feeRate = mintManager.feeRate();
        uint8 rateDecimal = mintManager.rateDecimal();
        payable(omA).transfer((msg.value * feeRate) / (10**rateDecimal));
    }

    function mintDirect(address _to, uint16 _quantity) public {
        require(!mintEnd, 'MT7');
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        mintLoop(_to, _quantity);
    }

    function mintLoop(address _to, uint16 _quantity) internal {
        uint256[] memory tokenIds = new uint256[](_quantity);
        for (uint32 i; i < _quantity; i++) {
            _tokenIdCounter.increment();
            tokenIds[i] = _tokenIdCounter.current();

            _mint(_to, tokenIds[i], 1, '');
        }
    }

    function endMint() public onlyOwner {
        mintEnd = true;
    }

    function setUri(string memory __uri) external onlyOwner {
        _setURI(__uri);
        isRevealed = true;
        emit UriChanged(__uri, 'base');
    }

    function setCoverUri(string memory _coverUri) external onlyOwner {
        coverUri = _coverUri;
        emit UriChanged(_coverUri, 'cover');
    }

    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    function withdraw() external onlyOwner {
        console.log('balance: %s', address(this).balance);
        payable(msg.sender).transfer(address(this).balance);
    }
}
