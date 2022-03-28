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

/// @title OmnuumNFT1155 - nft contract written based on ERC1155
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Omnuum specific nft contract which pays mint fee to omnuum but can utilize omnuum protocol
contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager caManager;
    OmnuumMintManager mintManager;
    address omA;

    /// @notice max amount can be minted
    uint32 public maxSupply;

    /// @notice whether revealed or not
    bool public isRevealed;

    string internal coverUri;

    event Uri(string uri);
    event ReceiveFee(uint256 amount);

    /// @notice constructor function for upgradeable
    /// @param _caManagerAddress ca manager address
    /// @param _omA omnuum address
    /// @param _maxSupply max amount can be minted
    /// @param _coverUri metadata uri for before reveal
    /// @param _prjOwner project owner address to transfer ownership
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

    /// @dev send fee to omnuum wallet
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

    /// @notice public minting function
    /// @param _quantity minting quantity
    /// @param _groupId public minting schedule id
    /// @param _payload payload for authenticate that mint call happen through omnuum server to guarantee exact schedule time
    function publicMint(
        uint32 _quantity,
        uint16 _groupId,
        SenderVerifier.Payload calldata _payload
    ) public payable nonReentrant {
        require(msg.sender.code.length == 0, 'MT9');
        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', _groupId, _payload);

        mintManager.publicMint(_groupId, _quantity, msg.value, msg.sender);

        mintLoop(msg.sender, _quantity);
        sendFee();
    }

    /// @notice ticket minting function
    /// @param _quantity minting quantity
    /// @param _ticket ticket struct which proves authority to mint
    /// @param _payload payload for authenticate that mint call happen through omnuum server to guarantee exact schedule time
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
        sendFee();
    }

    /// @notice direct mint, neither public nor ticket
    /// @param _to mint destination address
    /// @param _quantity minting quantity
    function mintDirect(address _to, uint32 _quantity) public {
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        mintLoop(_to, _quantity);
    }

    /// @dev minting utility function, manage token id
    /// @param _to mint destination address
    /// @param _quantity minting quantity
    function mintLoop(address _to, uint32 _quantity) internal {
        require(_tokenIdCounter.current() + _quantity <= maxSupply, 'MT3');
        uint256[] memory tokenIds = new uint256[](_quantity);
        for (uint32 i; i < _quantity; i++) {
            _tokenIdCounter.increment();
            tokenIds[i] = _tokenIdCounter.current();

            _mint(_to, tokenIds[i], 1, '');
        }
    }

    /// @notice set uri for reveal
    /// @param __uri uri of revealed metadata
    function setUri(string memory __uri) external onlyOwner {
        require(!isRevealed, 'Already Revealed');
        _setURI(__uri);
        isRevealed = true;
        emit Uri(__uri);
    }

    /// @notice get current metadata uri
    function uri(uint256) public view override returns (string memory) {
        return !isRevealed ? coverUri : super.uri(1);
    }

    /// @notice withdraw balance
    function withdraw() external onlyOwner {
        payable(msg.sender).sendValue(address(this).balance);
    }
}
