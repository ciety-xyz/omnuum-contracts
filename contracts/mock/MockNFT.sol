// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '../utils/Ownable.sol';
import '../V1/TicketManager.sol';
import '../V1/OmnuumMintManager.sol';
import '../V1/SenderVerifier.sol';

// for ticket manager
contract MockNFT is Ownable {
    address senderVerifier;
    address ticketManager;

    constructor(address _senderVerifierAddress, address _ticketManagerAddress) {
        senderVerifier = _senderVerifierAddress;
        ticketManager = _ticketManagerAddress;
    }

    function useTicket(
        address _signer,
        address _minter,
        uint16 _quantity,
        TicketManager.Ticket calldata _ticket
    ) public {
        TicketManager(ticketManager).useTicket(_signer, _minter, _quantity, _ticket);
    }

    function publicMint(
        address _target,
        uint16 _groupId,
        uint32 _quantity,
        uint256 value,
        address _minter
    ) public {
        OmnuumMintManager(_target).preparePublicMint(_groupId, _quantity, value, _minter);
    }

    function publicContractMint(
        address payable _target,
        uint16 _groupId,
        uint32 _quantity,
        SenderVerifier.Payload calldata _payload
    ) public payable {
        OmnuumNFT1155(_target).publicMint(_quantity, _groupId, _payload);
    }

    function ticketContractMint(
        address payable _target,
        uint32 _quantity,
        TicketManager.Ticket calldata _ticket,
        SenderVerifier.Payload calldata _payload
    ) public payable {
        OmnuumNFT1155(_target).ticketMint(_quantity, _ticket, _payload);
    }
}
