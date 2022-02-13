// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract TicketVerifier is EIP712 {
    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    struct Ticket {
        address user;
        address nft;
        uint256 price;
        uint16 quantity;
        uint16 groupId;
        bytes signature;
    }

    // nft => groupId => end date
    mapping(address => mapping(uint16 => uint256)) endDates;

    // nft => groupId => ticket owner => use count
    mapping(address => mapping(uint16 => mapping(address => uint32))) ticketUsed;

    string private constant SIGNING_DOMAIN = 'OmnuumTicket';
    string private constant SIGNATURE_VERSION = '1';

    function setEndDate(
        address nft,
        uint16 groupId,
        uint256 endDate
    ) external {
        require(Ownable(nft).owner() == msg.sender, 'Only owner of nft');
        endDates[nft][groupId] = endDate;
    }

    function verify(
        address _signer,
        address _minter,
        uint16 _quantity,
        Ticket calldata _ticket
    ) external {
        require(block.timestamp <= endDates[msg.sender][_ticket.groupId], 'MT8');
        address signer = recoverSigner(_ticket);
        require(_signer == signer, 'False Signer');
        require(_ticket.nft == msg.sender, 'False NFT');
        require(_minter == _ticket.user, 'False Minter');
        require(ticketUsed[msg.sender][_ticket.groupId][_minter] + _quantity <= _ticket.quantity, 'MT3');

        ticketUsed[msg.sender][_ticket.groupId][_minter] += _quantity;
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
                        keccak256('Ticket(address user,address nft,uint256 price,uint16 quantity,uint16 groupId)'),
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
