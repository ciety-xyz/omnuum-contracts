// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract TicketManager is EIP712 {
    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    struct Ticket {
        address user;
        address nft;
        uint256 price;
        uint32 quantity;
        uint256 groupId;
        bytes signature;
    }

    // nft => groupId => end date
    mapping(address => mapping(uint256 => uint256)) endDates;

    // nft => groupId => ticket owner => use count
    mapping(address => mapping(uint256 => mapping(address => uint32))) ticketUsed;

    string private constant SIGNING_DOMAIN = 'OmnuumTicket';
    string private constant SIGNATURE_VERSION = '1';

    event EndDate(address indexed nft, uint256 groupId, uint256 endDate);
    event UseTicket(address indexed nft, address minter, uint32 quantity, Ticket ticket);

    function setEndDate(
        address _nft,
        uint256 groupId,
        uint256 endDate
    ) external {
        require(Ownable(_nft).owner() == msg.sender, 'OO1');
        endDates[_nft][groupId] = endDate;

        emit EndDate(_nft, groupId, endDate);
    }

    function useTicket(
        address _signer,
        address _minter,
        uint32 _quantity,
        Ticket calldata _ticket
    ) public {
        verify(_signer, msg.sender, _minter, _quantity, _ticket);

        ticketUsed[msg.sender][_ticket.groupId][_minter] += _quantity;
        emit UseTicket(msg.sender, _minter, _quantity, _ticket);
    }

    function verify(
        address _signer,
        address _nft,
        address _minter,
        uint32 _quantity,
        Ticket calldata _ticket
    ) public view {
        require(block.timestamp <= endDates[_nft][_ticket.groupId], 'MT8');
        require(_signer == recoverSigner(_ticket), 'False Signer');
        require(_ticket.nft == _nft, 'False NFT');
        require(_minter == _ticket.user, 'False Minter');
        require(ticketUsed[_nft][_ticket.groupId][_minter] + _quantity <= _ticket.quantity, 'MT3');
    }

    function recoverSigner(Ticket calldata _ticket) internal view returns (address) {
        bytes32 digest = _hash(_ticket);
        return ECDSA.recover(digest, _ticket.signature);
    }

    function _hash(Ticket calldata _ticket) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256('Ticket(address user,address nft,uint256 price,uint32 quantity,uint256 groupId)'),
                        _ticket.user,
                        _ticket.nft,
                        _ticket.price,
                        _ticket.quantity,
                        _ticket.groupId
                    )
                )
            );
    }
}
