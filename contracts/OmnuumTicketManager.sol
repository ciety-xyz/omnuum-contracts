// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';

contract OmnuumTicketManager {
    struct MintTicket {
        uint16 receivedCount;
        uint16 usedCount;
    }

    // NFT Contract Address => Ticket Group => end date'
    mapping(address => mapping(uint32 => uint256)) public endDates;

    // NFT Contract Address => Ticket Group => Ticket Owner => Ticket Price => Ticket(count)
    mapping(address => mapping(uint32 => mapping(address => mapping(uint256 => MintTicket)))) public mintTickets;

    // actionType: mint, use
    event Ticket(address nftContract, address to, uint256 quantity, uint256 price, uint32 groupId, string actionType);

    function useTicket(
        address _to,
        uint16 _quantity,
        uint256 _price,
        uint32 _groupId
    ) external {
        MintTicket storage ticket = mintTickets[msg.sender][_groupId][_to][_price];
        uint256 endDate = endDates[msg.sender][_groupId];

        require(ticket.usedCount + _quantity <= ticket.receivedCount, 'MT1');
        require(endDate > block.timestamp, 'MT8');

        ticket.usedCount += _quantity;
        emit Ticket(msg.sender, _to, _price, _quantity, _groupId, 'use');
    }

    function giveTicketBatch(
        address CA,
        address[] calldata _tos,
        uint16[] calldata _quantitys,
        uint256[] calldata _prices,
        uint32 _groupId,
        uint256 _endDate
    ) public {
        require(Ownable(CA).owner() == msg.sender, 'OO1');
        require(_tos.length == _quantitys.length, 'ARG1');
        require(_quantitys.length == _prices.length, 'ARG1');

        uint256 len = _tos.length;

        endDates[CA][_groupId] = _endDate;

        for (uint16 i; i < len; i++) {
            mintTickets[CA][_groupId][_tos[i]][_prices[i]].receivedCount += _quantitys[i];
            emit Ticket(CA, _tos[i], _quantitys[i], _prices[i], _groupId, 'mint');
        }
    }
}
