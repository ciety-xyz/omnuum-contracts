// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './interfaces/ISenderVerifier.sol';
import './OmnuumMintManager.sol';
import './OmnuumCAManager.sol';
import './TicketManager.sol';

contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager caManager;
    OmnuumMintManager mintManager;
    address omA;

    uint32 public maxSupply;

    bool public isRevealed;

    string internal coverUri;

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

    function isContract(address _addr) internal view returns (bool) {
        uint32 codeSize;
        assembly {
            codeSize := extcodesize(_addr)
        }
        return codeSize > 0;
    }

    function sendFee() internal {
        uint256 feeRate = mintManager.feeRate();
        uint8 rateDecimal = mintManager.rateDecimal();
        uint256 amount = (msg.value * feeRate) / (10**rateDecimal);
        payable(omA).transfer(amount);
        emit ReceiveFee(amount);
    }

    function publicMint(
        uint32 _quantity,
        uint16 _groupId,
        ISenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(!isContract(msg.sender), 'MT9');
        ISenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', _groupId, _payload);

        mintManager.publicMint(_groupId, _quantity, msg.value, msg.sender);

        mintLoop(msg.sender, _quantity);
        sendFee();
    }

    function ticketMint(
        uint32 _quantity,
        TicketManager.Ticket calldata _ticket,
        ISenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(_ticket.price * _quantity <= msg.value, 'MT5');
        require(!isContract(msg.sender), 'MT9');

        ISenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'TICKET', _ticket.groupId, _payload);
        TicketManager(caManager.getContract('TICKET')).useTicket(omA, msg.sender, _quantity, _ticket);

        mintLoop(msg.sender, _quantity);
        sendFee();
    }

    function mintDirect(address _to, uint32 _quantity) public {
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        mintLoop(_to, _quantity);
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
        emit Uri(__uri);
    }

    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}
