const createContractBody = ({
  ticketManagerAddress,
  vrfManagerAddress,
  mintManagerAddress,
  verifierAddress,
}) => `// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './interfaces/ISenderVerifier.sol';
import './OmnuumVRFManager.sol';
import './OmnuumMintManager.sol';
import './OmnuumCAManager.sol';
import './OmnuumTicketManager.sol';

contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;
    
    address constant vrfA = ${vrfManagerAddress}; vrfManager
    address constant mmA = ${mintManagerAddress}; // mintManager
    address constant verA = ${verifierAddress}; // sendVerifier
    address constant ticketA = ${ticketManagerAddress}; // ticketManager

    OmnuumCAManager caManager;
    address omA;

    uint256 public basePrice;
    uint32 maxSupply;
    uint32 maxMintPerAddress;
     
    mapping(address => uint16) publicMintCnt;

    bool mintEnd;
    bool isPublic;
    bool isRevealed;

    string private coverUri;

    event Reveal(uint256);

    // actionType: cover, base
    event UriChanged(string uri, string actionType);

    function initialize(
        string calldata _uri,
        address _caManagerAddress,
        address _omA, // omnuum company wallet address
        uint32 _maxMintPerAddress,
        uint32 _maxSupply,
        string calldata _coverUri
    ) public initializer {
        __ERC1155_init(_uri);
        __ReentrancyGuard_init();
        __Ownable_init();

        maxSupply = _maxSupply;
        maxMintPerAddress = _maxMintPerAddress;

        omA = _omA;
        caManager = OmnuumCAManager(_caManagerAddress);
    }

    function changePublicMint(bool _isPublic, uint256 _basePrice) public {
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        isPublic = _isPublic;
        basePrice = _basePrice;
    }

    function mint(
        address _to,
        uint16 _quantity,
        uint256 _price,
        ISenderVerifier.Payload calldata payload
    ) public payable nonReentrant {
        require(!mintEnd, 'MT7');
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        require(msg.value >= _price * _quantity, 'MT5');

        ISenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', payload);

        if (isPublic && (_price == basePrice)) {
            // address 당 체크
            require(publicMintCnt[msg.sender] + _quantity <= maxMintPerAddress, 'MT2');
        } else {
            OmnuumTicketManager(caManager.getContract('TICKETMANAGER')).useTicket(
                msg.sender,
                _quantity,
                _price
            );
        }

        mintLoop(_to, _quantity);

        OmnuumMintManager mintManager = OmnuumMintManager(caManager.getContract('MINTMANAGER'));
        uint256 feeRate = mintManager.feeRate();
        uint8 rateDecimal = mintManager.rateDecimal();
        payable(omA).transfer((msg.value * feeRate) / (10**rateDecimal) / 100);
    }

    function mintDirect(address _to, uint16 _quantity) public {
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'ARG2');
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
        ef
        emit UriChanged(__uri, 'base');
    }

    function setCoverUri(string memory _coverUri) external onlyOwner {
        coverUri = _coverUri;
        emit UriChanged(_coverUri, 'cover');
    }

    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    function vrfRequest(ISenderVerifier.Payload memory payload) external payable {
        require(!isRevealed);
        OmnuumVRFManager(caManager.getContract('VRF')).requestVRFOnce{ value: msg.value }(payload);
    }

    function vrfResponse(uint256 num) external {
        require(msg.sender == caManager.getContract('VRF'));
        emit Reveal(num);
    }

    function withdraw() external onlyOwner {
        payable(address(this)).transfer(address(this).balance);
    }
}
`;
