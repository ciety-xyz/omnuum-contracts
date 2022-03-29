// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '../utils/OwnableUpgradeable.sol';
import './SenderVerifier.sol';
import './OmnuumMintManager.sol';
import './OmnuumCAManager.sol';
import './TicketManager.sol';
import './OmnuumWallet.sol';

contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager caManager;
    address mintManagerA;
    address omA;

    uint32 public maxSupply;
    bool public isRevealed;
    string public coverUri;

    event Uri(address indexed nftContract, string indexed uri);
    event FeePaid(address indexed payer, uint256 amount);

    function initialize(
        address _caManagerAddress,
        address _omA, // omnuum deployer
        uint32 _maxSupply,
        string calldata _coverUri,
        address _prjOwner
    ) public initializer {
        __ERC1155_init('');
        __ReentrancyGuard_init();
        __Ownable_init();

        maxSupply = _maxSupply;

        omA = _omA;
        caManager = OmnuumCAManager(_caManagerAddress);
        mintManagerA = caManager.getContract('MINTMANAGER');

        coverUri = _coverUri;

        transferOwnership(_prjOwner);
    }

    function sendFee(uint32 quantity) internal {
        OmnuumMintManager mintManager = OmnuumMintManager(mintManagerA);
        uint8 rateDecimal = mintManager.rateDecimal();
        uint256 baseFeeRate = mintManager.baseFeeRate();
        uint256 minFee = mintManager.minFee();
        uint256 feeRate = baseFeeRate * (10**rateDecimal - mintManager.discountRate(address(this)));
        uint256 calculatedFee = (msg.value * feeRate) / 10**(rateDecimal * 2);
        uint256 minimumFee = quantity * minFee;

        uint256 paidAmount = calculatedFee > minimumFee ? calculatedFee : minimumFee;

        OmnuumWallet(payable(caManager.getContract('WALLET'))).makePayment{ value: paidAmount }(
            keccak256(abi.encodePacked('MINT_FEE')),
            ''
        );

        emit FeePaid(msg.sender, paidAmount);
    }

    function publicMint(
        uint32 _quantity,
        uint16 _groupId,
        SenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(msg.sender.code.length == 0, 'MT9');
        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', _groupId, _payload);

        OmnuumMintManager(mintManagerA).preparePublicMint(_groupId, _quantity, msg.value, msg.sender);

        mintLoop(msg.sender, _quantity);
        sendFee(_quantity);
    }

    function ticketMint(
        uint32 _quantity,
        TicketManager.Ticket calldata _ticket,
        SenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(!msg.sender.isContract(), 'MT9');
        require(_ticket.price * _quantity <= msg.value, 'MT5');

        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'TICKET', _ticket.groupId, _payload);
        TicketManager(caManager.getContract('TICKET')).useTicket(omA, msg.sender, _quantity, _ticket);

        mintLoop(msg.sender, _quantity);
        sendFee(_quantity);
    }

    function mintDirect(address _to, uint32 _quantity) public payable {
        require(msg.sender == mintManagerA, 'OO2');

        uint256 minFee = OmnuumMintManager(mintManagerA).minFee();
        require(msg.value >= minFee * _quantity, 'MT5');

        mintLoop(_to, _quantity);

        sendFee(_quantity);
    }

    function mintLoop(address _to, uint32 _quantity) internal {
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        uint256[] memory tokenIds = new uint256[](_quantity);
        for (uint32 i; i < _quantity; i++) {
            _tokenIdCounter.increment();
            tokenIds[i] = _tokenIdCounter.current();

            _mint(_to, tokenIds[i], 1, '');
        }
    }

    function setUri(string memory __uri) external onlyOwner {
        require(!isRevealed, 'Already Revealed');
        _setURI(__uri);
        isRevealed = true;
        emit Uri(address(this), __uri);
    }

    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).sendValue(address(this).balance);
    }
}
