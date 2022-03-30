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

/// @title OmnuumNFT1155 - nft contract written based on ERC1155
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Omnuum specific nft contract which pays mint fee to omnuum but can utilize omnuum protocol
contract OmnuumNFT1155 is ERC1155Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    OmnuumCAManager private caManager;
    OmnuumMintManager private mintManager;

    /// @notice max amount can be minted
    uint32 public maxSupply;

    /// @notice whether revealed or not
    bool public isRevealed;
    string private coverUri;
    address private omA;

    event Uri(address indexed nftContract, string indexed uri);
    event FeePaid(address indexed payer, uint256 amount);

    /// @notice constructor function for upgradeable
    /// @param _caManagerAddress ca manager address
    /// @param _omA omnuum company address
    /// @param _maxSupply max amount can be minted
    /// @param _coverUri metadata uri for before reveal
    /// @param _prjOwner project owner address to transfer ownership
    function initialize(
        address _caManagerAddress,
        address _omA, // omnuum deployer
        uint32 _maxSupply,
        string calldata _coverUri,
        address _prjOwner
    ) public initializer {
        /// @custom:error (AE1) - Zero address not acceptable
        require(_caManagerAddress != address(0), 'AE1');
        require(_prjOwner != address(0), 'AE1');

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
    function sendFee(uint32 _quantity) internal {
        uint8 rateDecimal = mintManager.rateDecimal();
        uint256 minFee = mintManager.minFee();
        uint256 feeRate = mintManager.getFeeRate(address(this));
        uint256 calculatedFee = (msg.value * feeRate) / 10**rateDecimal;
        uint256 minimumFee = _quantity * minFee;

        uint256 feePayment = calculatedFee > minimumFee ? calculatedFee : minimumFee;

        OmnuumWallet(payable(caManager.getContract('WALLET'))).makePayment{ value: feePayment }(
            keccak256(abi.encodePacked('MINT_FEE')),
            ''
        );

        emit FeePaid(msg.sender, feePayment);
    }

    /// @notice public minting function
    /// @param _quantity minting quantity
    /// @param _groupId public minting schedule id
    /// @param _payload payload for authenticate that mint call happen through omnuum server to guarantee exact schedule time
    function publicMint(
        uint32 _quantity,
        uint16 _groupId,
        SenderVerifier.Payload calldata _payload
    ) external payable nonReentrant {
        /// @custom:error (MT9) - Minter cannot be CA
        require(msg.sender.code.length == 0, 'MT9');
        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'MINT', _groupId, _payload);

        mintManager.preparePublicMint(_groupId, _quantity, msg.value, msg.sender);

        mintLoop(msg.sender, _quantity);
        sendFee(_quantity);
    }

    /// @notice ticket minting function
    /// @param _quantity minting quantity
    /// @param _ticket ticket struct which proves authority to mint
    /// @param _payload payload for authenticate that mint call happen through omnuum server to guarantee exact schedule time
    function ticketMint(
        uint32 _quantity,
        TicketManager.Ticket calldata _ticket,
        SenderVerifier.Payload calldata _payload
    ) external payable nonReentrant {
        /// @custom:error (MT9) - Minter cannot be CA
        require(!msg.sender.isContract(), 'MT9');

        /// @custom:error (MT5) - Not enough money
        require(_ticket.price * _quantity <= msg.value, 'MT5');

        SenderVerifier(caManager.getContract('VERIFIER')).verify(omA, msg.sender, 'TICKET', _ticket.groupId, _payload);
        TicketManager(caManager.getContract('TICKET')).useTicket(omA, msg.sender, _quantity, _ticket);

        mintLoop(msg.sender, _quantity);
        sendFee(_quantity);
    }

    /// @notice direct mint, neither public nor ticket
    /// @param _to mint destination address
    /// @param _quantity minting quantity
    function mintDirect(address _to, uint32 _quantity) external payable {
        /// @custom:error (OO2) - Only Omnuum or owner can change
        require(msg.sender == caManager.getContract('MINTMANAGER') || msg.sender == owner(), 'OO2');
        mintLoop(_to, _quantity);

        sendFee(_quantity);
    }

    /// @dev minting utility function, manage token id
    /// @param _to mint destination address
    /// @param _quantity minting quantity
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

    /// @notice set uri for reveal
    /// @param __uri uri of revealed metadata
    function setUri(string memory __uri) external onlyOwner {
        /// @custom:error (SE6) - NFT already revealed
        require(!isRevealed, 'SE6');
        _setURI(__uri);
        isRevealed = true;
        emit Uri(address(this), __uri);
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
