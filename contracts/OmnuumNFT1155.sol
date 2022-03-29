// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './SenderVerifier.sol';
import './OmnuumMintManager.sol';
import './OmnuumCAManager.sol';
import './TicketManager.sol';

contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager private caManager;
    OmnuumMintManager private mintManager;
    address private omA;

    uint32 public maxSupply;

    bool public isRevealed;

    string private coverUri;

    event Uri(string uri);
    event ReceiveFee(uint256 amount);

    function initialize(
        address _caManagerAddress,
        address _omA, // omnuum company wallet address
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
        mintManager = OmnuumMintManager(caManager.getContract('MINTMANAGER'));
        coverUri = _coverUri;

        transferOwnership(_prjOwner);
    }

    function sendFee() internal {
        uint8 rateDecimal = mintManager.rateDecimal();
        uint256 baseFeeRate = mintManager.baseFeeRate();
        uint256 feeRate = baseFeeRate * (10**rateDecimal - mintManager.discountRate(address(this)));
        uint256 amount = (msg.value * feeRate) / 10**(rateDecimal * 2);
        if (amount > 0) {
            address feeReceiver = caManager.getContract('WALLET');
            payable(feeReceiver).sendValue(amount);
        }
        emit ReceiveFee(amount);
    }

    function publicMint(
        uint32 _quantity,
        uint16 _groupId,
        SenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        /// @custom:error (MT9) - Mint subject cannot be CA
        require(msg.sender.code.length == 0, 'MT9');
        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', _groupId, _payload);

        mintManager.publicMint(_groupId, _quantity, msg.value, msg.sender);

        mintLoop(msg.sender, _quantity);
        sendFee();
    }

    function ticketMint(
        uint32 _quantity,
        TicketManager.Ticket calldata _ticket,
        SenderVerifier.Payload calldata _payload
    ) external payable nonReentrant {
        /// @custom:error (MT9) - Mint subject cannot be CA
        require(!msg.sender.isContract(), 'MT9');

        /// @custom:error (MT5) - Not enough money
        require(_ticket.price * _quantity <= msg.value, 'MT5');

        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'TICKET', _ticket.groupId, _payload);
        TicketManager(caManager.getContract('TICKET')).useTicket(omA, msg.sender, _quantity, _ticket);

        mintLoop(msg.sender, _quantity);
        sendFee();
    }

    function mintDirect(address _to, uint32 _quantity) external {
        /// @custom:error (OO2) - Only Omnuum or owner can change
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        mintLoop(_to, _quantity);
    }

    function mintLoop(address _to, uint32 _quantity) internal {
        /// @custom:error (MT3) - Remaining token count is not enough
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        uint256[] memory tokenIds = new uint256[](_quantity);
        for (uint32 i = 0; i < _quantity; i++) {
            _tokenIdCounter.increment();
            tokenIds[i] = _tokenIdCounter.current();

            _mint(_to, tokenIds[i], 1, '');
        }
    }

    function setUri(string memory __uri) external onlyOwner {
        /// @custom:error (SE6) - NFT already revealed
        require(!isRevealed, 'SE6');
        _setURI(__uri);
        isRevealed = true;
        emit Uri(__uri);
    }

    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).sendValue(address(this).balance);
    }
}
