// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/utils/Address.sol';

// @title OmnuumWallet - Allows multiple owners to agree on withdraw money before execution
// @notice This contract is managed by Omnuum admin
// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
// @version V1

contract OmnuumWallet {
    using Address for address;
    using Address for address payable;

    /* *****************************************************************************
     * Events
     * *****************************************************************************/
    event FeeReceived(address indexed nftContract, address indexed sender, uint256 value);
    event Requested(uint256 indexed reqId, address indexed requester);
    event Approved(uint256 indexed reqId, address indexed owner);
    event Revoked(uint256 indexed reqId, address indexed owner);
    event Withdrawn(uint256 indexed reqId, address indexed receiver, uint256 value);

    /* *****************************************************************************
     * Storages
     * *****************************************************************************/
    // @param address for multisig wallet owners
    address[] public owners;

    // @param owner address => existance
    mapping(address => bool) public isOwner;

    // @param request id => owner address => approval status
    mapping(uint256 => mapping(address => bool)) approvals;

    // @param destination - address for money receiver
    // @param value - amount of withdrawal money
    // @param withdrawn - status for the withdraw execution
    struct Request {
        address destination;
        uint256 value;
        bool withdrawn;
    } // withdrawal destination address, amount of withdrawal, tag for withdrawn

    Request[] public requests;

    /* *****************************************************************************
     * Modifiers
     * *****************************************************************************/
    modifier onlyOwners() {
        require(isOwner[msg.sender], 'only owner');
        _;
    }
    modifier reqExists(uint256 _id) {
        require(_id < requests.length, 'request not exist');
        _;
    }
    modifier notApproved(uint256 _id) {
        require(!approvals[_id][msg.sender], 'already approved');
        _;
    }
    modifier isApproved(uint256 _id) {
        require(approvals[_id][msg.sender], 'not approved');
        _;
    }
    modifier notWithdrawn(uint256 _id) {
        require(!requests[_id].withdrawn, 'already withdrawn');
        _;
    }
    modifier isAllAgreed(uint256 _id) {
        require(getApprovalCount(_id) == owners.length, 'consensus not reached');
        _;
    }

    constructor(address[] memory _owners) {
        //minimum 2 owners are required for multi sig wallet
        require(_owners.length > 1, 'single owner');

        //Register owners
        for (uint256 i; i < _owners.length; i++) {
            address owner = _owners[i];
            require(!isOwner[owner], 'Owner exists');
            require(!owner.isContract(), 'not EOA');
            require(owner != address(0), 'Invalid address');

            isOwner[owner] = true;
            owners.push(owner);
        }
    }

    /* *****************************************************************************
     * Functions
     * *****************************************************************************/

    // @dev Fallback function allows to deposit ether.

    fallback() external payable {
        // msg.data will be address for NFT proxy contract
        address nftContract;
        bytes memory _data = msg.data;
        assembly {
            nftContract := mload(add(_data, 20))
        }
        emit FeeReceived(nftContract, msg.sender, msg.value);
    }

    // @dev Allows an owner to request approval for future execution of withdrawal
    // @param _withdrawalValue - amount of Ether to be withdrawal
    // @return unique ID (nonce) for the request

    function approvalRequest(uint256 _withdrawalValue) external onlyOwners returns (uint256) {
        require(_withdrawalValue <= address(this).balance, 'request value exceeds balance');

        requests.push(Request({ destination: msg.sender, value: _withdrawalValue, withdrawn: false }));

        uint256 reqId = requests.length - 1;

        approve(reqId);

        emit Requested(reqId, msg.sender);
        return (reqId);
    }

    // @dev Allows an owner to approve the request
    // @param _reqId - request id for approval

    function approve(uint256 _reqId) public onlyOwners reqExists(_reqId) notApproved(_reqId) notWithdrawn(_reqId) {
        approvals[_reqId][msg.sender] = true;
        emit Approved(_reqId, msg.sender);
    }

    // @dev Allows to check whether the owner has approved the request of specific id or not
    // @param _reqId - request id for approval
    // @param _approver - owner address for approver
    // @return status of approval

    function checkApproval(uint256 _reqId, address _approver) public view returns (bool) {
        return approvals[_reqId][_approver];
    }

    // @dev Allows to check how many times it has been approved
    // @param _reqId - request id for approval
    // @return number of approvals

    function getApprovalCount(uint256 _reqId) public view returns (uint256) {
        uint256 count;
        for (uint256 i; i < owners.length; i++) {
            if (checkApproval(_reqId, owners[i])) {
                count++;
            }
        }
        return count;
    }

    // @dev Allows an owner to revoke approval
    // @param _reqId - request id for approval

    function revokeApproval(uint256 _reqId) external onlyOwners reqExists(_reqId) isApproved(_reqId) notWithdrawn(_reqId) {
        approvals[_reqId][msg.sender] = false;
        emit Revoked(_reqId, msg.sender);
    }

    // @dev Allows an owner to withdraw the balance
    // @param _reqId - request id for approval

    function withdrawal(uint256 _reqId) external onlyOwners reqExists(_reqId) notWithdrawn(_reqId) isAllAgreed(_reqId) {
        Request storage request = requests[_reqId];
        require(msg.sender == request.destination, 'withdrawer must be the requester');

        request.withdrawn = true;
        payable(request.destination).sendValue(request.value);
        emit Withdrawn(_reqId, request.destination, request.value);
    }
}
