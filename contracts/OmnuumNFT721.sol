//// SPDX-License-Identifier: GPL-3.0
//pragma solidity >=0.7.0 <0.9.0;
//
//import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
//import "./SenderVerifier.sol";
//
//contract OmnuumNFT721 is ERC721Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
//    struct MintTicket {
//        uint16 receivedCount;
//        uint16 usedCount;
//    }
//
//    using CountersUpgradeable for CountersUpgradeable.Counter;
//    CountersUpgradeable.Counter private _tokenIdCounter;
//
//    // owner of this collection
//    address mintManagerAddress;
//    address omnuumCompanyAddress;
//    address constant mintVerifierAddress  = address(0);
//
//    bytes32 baseUri;
//    uint256 basePrice;
//    uint32 maxSupply;
//    uint32 ticketRound;
//    uint32 maxMintPerTx;
//
//    bool mintEnd;
//    bool isPublic;
//    bool isRevealed;
//
//    // // metadata URI
//    string private baseTokenURI;
//    string private coverImageUri;
//
//    // round => future minter => price => ticket
//    mapping (uint32 => mapping (address => mapping(uint256 => MintTicket))) mintTickets;
//
//    event GiveTicket (address to, uint256 price, uint256 quantity);
//    event UseTicket (address to, uint256 price, uint256 quantity);
//
//    function initialize(
//        string memory _baseTokenURI,
//        address _omnuumAddress,
//        uint32 _maxMintPerTx,
//        uint256 _basePrice,
//        bool _isPublic,
//        uint32 _maxSupply,
//        string memory _name,
//        string memory _symbol
//    ) public initializer {
//        __ERC721_init(_name, _symbol);
//        __ReentrancyGuard_init();
//        __Ownable_init();
//
//        // @dev omnuum address for fees and maintenance
//        omnuumCompanyAddress = _omnuumAddress;
//        maxSupply = _maxSupply;
//        maxMintPerTx = _maxMintPerTx;
//        basePrice = _basePrice;
//        isPublic = _isPublic;
//        baseTokenURI = _baseTokenURI;
//    }
//
//    function changeOmnuumAddress(address _newOmnuum) public {
//        require(msg.sender == omnuumCompanyAddress, "OO3");
//        omnuumCompanyAddress = _newOmnuum;
//    }
//
//    function mint(address _to, uint16 _quantity, uint256 _price, MintVerifier.Voucher calldata voucher) public payable nonReentrant returns (uint256[] memory) {
//        require(!mintEnd, "MT7");
//        require(_tokenIdCounter.current() + _quantity <= maxSupply, "MT3");
//        require(msg.value >= _price * _quantity, "MT5");
//
//        MintVerifier(mintVerifierAddress).verify(omnuumCompanyAddress, msg.sender, voucher);
//
//        // @dev pass if sender is mint manager, condition already checked at manager
//        if (msg.sender != mintManagerAddress) {
//            if (isPublic && _price == basePrice) {
//                require(maxMintPerTx >= _quantity, "MT2");
//            } else {
//                MintTicket storage ticket = mintTickets[ticketRound][msg.sender][_price];
//                require(ticket.usedCount + _quantity <= ticket.receivedCount, "MT1");
//                ticket.usedCount += _quantity;
//            }
//        }
//
//        return mintLoop(_to, _quantity);
//    }
//
//    function mintDirect(address _to, uint16 _quantity) public returns (uint256[] memory) {
//        require(msg.sender == owner() || msg.sender == mintManagerAddress, "OO2");
//        return mintLoop(_to, _quantity);
//    }
//
//    function mintLoop(address _to, uint16 _quantity) internal returns (uint256[] memory) {
//        uint256[] memory tokenIds = new uint[](_quantity);
//        for (uint32 i; i < _quantity; i++) {
//            _tokenIdCounter.increment();
//            tokenIds[i] = _tokenIdCounter.current();
//
//            _safeMint(_to, tokenIds[i]);
//        }
//
//        return tokenIds;
//    }
//
//    function giveTicketBatch(address[] calldata _tos, uint16[] calldata _quantitys, uint256[] calldata _prices) public {
//        require(_tos.length == _quantitys.length, "ARG1");
//        require(_quantitys.length == _prices.length, "ARG1");
//
//        uint256 len = _tos.length;
//
//        require(owner() == msg.sender, "OO1");
//
//        for (uint16 i; i < len; i++) {
//            mintTickets[ticketRound][_tos[i]][_prices[i]].receivedCount += _quantitys[i];
//            emit GiveTicket(_tos[i], _quantitys[i], _prices[i]);
//        }
//    }
//
//    function endMint() public onlyOwner {
//        mintEnd = true;
//    }
//
//    function setBaseURI(string calldata _baseTokenURI) external {
//        require(msg.sender == owner() || msg.sender == omnuumCompanyAddress, "OO2");
//        baseTokenURI = _baseTokenURI;
//    }
//
//    function setMintManager(address _mintManagerAddress) public onlyOwner {
//        // @dev mint manager contract has minting authority (for extended minting feature)
//        mintManagerAddress = _mintManagerAddress;
//    }
//
//    function _baseURI() internal view virtual override returns (string memory) {
//        return baseTokenURI;
//    }
//
//    function setCoverImageUri(string memory _coverImageUri) external {
//        require(msg.sender == owner() || msg.sender == omnuumCompanyAddress, "" );
//        coverImageUri = _coverImageUri;
//    }
//
//    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
//        require(_exists(tokenId), "NX1");
//
//        if (!isRevealed) {
//            return coverImageUri;
//        } else {
//            string memory baseURI = _baseURI();
//            return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, StringsUpgradeable.toString(tokenId))) : "";
//        }
//    }
//}
//
