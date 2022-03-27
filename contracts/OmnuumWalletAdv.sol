// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// @title OmnuumWalletAdv - Allows multiple owners to agree on withdraw money, add/remove/change owners before execution.
// @notice This contract is not managed by Omnuum admin, but for owners.
// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
// @version V1

contract OmnuumWalletAdv {
    uint256 immutable consensusRatio;
    uint8 immutable minLimitForConsensus;

    enum RequestTypes {
        Withdraw, // =0,
        Add, // =1,
        Remove, // =2,
        Change, // =3
        Cancel // =4
    }
    enum OwnerVotes {
        F, // =0,  F-Level: not owner
        D, // =1,  D-Level: 1 vote
        C // =2,  C-Level: 2 votes
    }
    struct OwnerAccount {
        address addr;
        OwnerVotes vote;
    }
    struct Request {
        address requester;
        RequestTypes requestType;
        OwnerAccount currentOwner;
        OwnerAccount newOwner;
        uint256 withdrawalAmount;
        mapping(address => bool) voters;
        uint256 votes;
        bool isExecute;
    }
    Request[] public requests;

    mapping(OwnerVotes => uint8) public ownerCounter;
    mapping(address => OwnerVotes) public ownerVote;

    /* *****************************************************************************
     *   Constructor
     * - set consensus ratio, minimum votes limit for consensus and initial owners
     * *****************************************************************************/
    constructor(
        uint256 _consensusRatio,
        uint8 _minLimitForConsensus,
        OwnerAccount[] memory _initialOwnerAccounts
    ) {
        consensusRatio = _consensusRatio;
        minLimitForConsensus = _minLimitForConsensus;

        for (uint256 i; i < _initialOwnerAccounts.length; i++) {
            OwnerVotes _vote = _initialOwnerAccounts[i].vote;
            ownerVote[_initialOwnerAccounts[i].addr] = _vote;
            ownerCounter[_vote]++;
        }
    }

    /* *****************************************************************************
     *   Events - TBD
     * *****************************************************************************/
    event PaymentReceived(bytes32 indexed topic, string description);
    event EtherReceived();

    /* *****************************************************************************
     *   Modifiers
     * *****************************************************************************/
    modifier onlyOwner(address _address) {
        require(isOwner(_address), 'Not owner');
        _;
    }

    modifier notOwner(address _address) {
        require(!isOwner(_address), 'Already owner');
        _;
    }

    modifier isOwnerAccount(OwnerAccount memory _ownerAccount) {
        address _addr = _ownerAccount.addr;
        require(isOwner(_addr) && uint8(ownerVote[_addr]) == uint8(_ownerAccount.vote), 'Account not exist');
        _;
    }

    modifier onlyRequester(uint256 _reqId) {
        require(requests[_reqId].requester == msg.sender, 'Only requester');
        _;
    }

    modifier reachConsensus(uint256 _reqId) {
        require(requests[_reqId].votes >= getRequiredVotesForConsensus(0), 'Not reach consensus');
        _;
    }

    modifier reqExists(uint256 _reqId) {
        require(_reqId < requests.length, 'Request not exists');
        _;
    }

    modifier notExecutedOrCanceled(uint256 _reqId) {
        require(!requests[_reqId].isExecute, 'Already executed');
        require(requests[_reqId].requestType != RequestTypes.Cancel, 'Request canceled');
        _;
    }

    modifier notVoted(uint256 _reqId) {
        require(!amIVoted(_reqId), 'Already voted');
        _;
    }

    modifier voted(uint256 _reqId) {
        require(amIVoted(_reqId), 'Not voted');
        _;
    }

    modifier isValidAddress(address _address) {
        require(_address != address(0), 'Zero address not acceptable');
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_address)
        }
        require(codeSize == 0, 'Contract address not acceptable'); // know that it's not perfect to protect, but can handle by the owners
        _;
    }

    /* *****************************************************************************
     *   Methods - Public, External
     * *****************************************************************************/

    function makePayment(bytes32 _topic, string calldata _description) external payable {
        require(msg.value > 0, 'Useless payment');
        // emit with msg.sender?
        emit PaymentReceived(_topic, _description);
    }

    receive() external payable {
        // emit with msg.sender?
        emit EtherReceived();
    }

    // @function request
    // @dev Allows an owner to request for an agenda that wants to proceed
    // @dev The owner can make multiple requests even if the previous one is unresolved.
    // @param _requestType - Withdraw(0) / Add(1) / Remove(2) / Change(3) / Cancel(4)
    // @param _currentAccount - Tuple[address, OwnerVotes] for current exist owner account (use for Request Type as Remove or Change)
    // @param _newAccount - Tuple[address, OwnerVotes] for new owner account (use for Request Type as Add or Change)
    // @param _withdrawalAmount - amount of Ether to be withdrawal (use for Request Type as Withdrawal)

    function request(
        RequestTypes _requestType,
        OwnerAccount calldata _currentAccount,
        OwnerAccount calldata _newAccount,
        uint256 _withdrawalAmount
    ) public onlyOwner(msg.sender) returns (uint256 reqId) {
        require(_requestType != RequestTypes.Cancel, 'Canceled request not acceptable');

        address _requester = msg.sender;

        Request storage _request = requests.push();
        _request.requester = _requester;
        _request.requestType = _requestType;
        _request.currentOwner = OwnerAccount({ addr: _currentAccount.addr, vote: _currentAccount.vote });
        _request.newOwner = OwnerAccount({ addr: _newAccount.addr, vote: _newAccount.vote });
        _request.withdrawalAmount = _withdrawalAmount;
        _request.voters[_requester] = true;
        _request.votes = uint8(ownerVote[_requester]);

        reqId = requests.length - 1;

        // emit Requested(indexed address owner, indexed uint256 requestId, indexed uint256 requestType)
    }

    // @function approve
    // @dev Allows owners to approve the request.
    // @dev The owner can revoke the approval whenever the request is still in progress (not executed or canceled).
    // @param _reqId - Request id that the owner wants to approve

    function approve(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecutedOrCanceled(_reqId) notVoted(_reqId) {
        OwnerVotes _vote = ownerVote[msg.sender];
        Request storage _request = requests[_reqId];
        _request.voters[msg.sender] = true;
        _request.votes += uint8(_vote);

        // emit Approved(indexed address owner, indexed uint256 requestId, uint256 votes)
    }

    // @function revoke
    // @dev Allow an approver(owner) to revoke the approval.
    // @param _reqId - Request id that the owner wants to revoke

    function revoke(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecutedOrCanceled(_reqId) voted(_reqId) {
        OwnerVotes _vote = ownerVote[msg.sender];
        Request storage _request = requests[_reqId];
        delete _request.voters[msg.sender];
        _request.votes -= uint8(_vote);

        // emit Revoked(indexed address owner, indexed requestId, uint256 votes)
    }

    // @function execute
    // @dev Allow an requester(owner) to execute the request
    // @dev After proceeding, it cannot revert the execution. Be cautious.
    // @parma _reqId - Request id that the requester wants to execute.

    function execute(uint256 _reqId) public reqExists(_reqId) notExecutedOrCanceled(_reqId) onlyRequester(_reqId) reachConsensus(_reqId) {
        Request storage _request = requests[_reqId];
        uint8 _type = uint8(_request.requestType);
        _request.isExecute = true;

        if (_type == uint8(RequestTypes.Withdraw)) {
            _withdraw(_request.withdrawalAmount, _request.requester);
        } else if (_type == uint8(RequestTypes.Add)) {
            _addOwner(_request.newOwner);
        } else if (_type == uint8(RequestTypes.Remove)) {
            _removeOwner(_request.currentOwner);
        } else if (_type == uint8(RequestTypes.Change)) {
            _changeOwner(_request.currentOwner, _request.newOwner);
        }

        // emit Executed(indexed address owner, indexed requestId, indexed requestType)
    }

    // @function cancelRequest
    // @dev Allows a requester(owner) to cancel the own request.
    // @dev After proceeding, it cannot revert the cancellation. Be cautious.
    // @param _reqId - Request id requested by the requester

    function cancelRequest(uint256 _reqId) public reqExists(_reqId) notExecutedOrCanceled(_reqId) onlyRequester(_reqId) {
        requests[_reqId].requestType = RequestTypes.Cancel;

        // emit Canceled(indexed address owner, indexed requestId)
    }

    /* *****************************************************************************
     *   Methods - View
     * *****************************************************************************/

    // @function totalVotes
    // @dev return the total number of voting rights the owners have

    function totalVotes() public view returns (uint256 votes) {
        votes = ownerCounter[OwnerVotes.D] + 2 * ownerCounter[OwnerVotes.C];
    }

    // @function isOwner
    // @dev return whether the owner is

    function isOwner(address _owner) public view returns (bool isValid) {
        isValid = uint8(ownerVote[_owner]) > 0;
    }

    function amIVoted(uint256 _reqId) public view reqExists(_reqId) returns (bool isValid) {
        isValid = requests[_reqId].voters[msg.sender];
    }

    function getRequiredVotesForConsensus(uint8 _deduction) public view returns (uint256 votesForConsensus) {
        votesForConsensus = ((totalVotes() - _deduction) * consensusRatio) / 100;
    }

    /* *****************************************************************************
     *   Functions - Internal, Private
     * *****************************************************************************/

    function _withdraw(uint256 _withdrawalAmount, address _to) private {
        require(_withdrawalAmount <= address(this).balance, 'Insufficient balance');
        (bool withdrawn, ) = payable(_to).call{ value: _withdrawalAmount }('');
        require(withdrawn, 'Address: unable to send value, recipient may have reverted');
    }

    function _addOwner(OwnerAccount memory _newAccount) private notOwner(_newAccount.addr) isValidAddress(_newAccount.addr) {
        OwnerVotes _vote = _newAccount.vote;
        ownerVote[_newAccount.addr] = _vote;
        ownerCounter[_vote]++;
    }

    function _removeOwner(OwnerAccount memory _removalAccount) private isOwnerAccount(_removalAccount) {
        _checkMinConsensus(uint8(ownerVote[_removalAccount.addr]));
        ownerCounter[_removalAccount.vote]--;
        delete ownerVote[_removalAccount.addr];
    }

    function _changeOwner(OwnerAccount memory _currentAccount, OwnerAccount memory _newAccount) private {
        //        require(!_isMatchAccount(_currentAccount, _newAccount), 'same account substitution');
        OwnerVotes _currentVote = _currentAccount.vote;
        OwnerVotes _newVote = _newAccount.vote;

        require(_newVote != OwnerVotes.F, 'F level votes not acceptable');
        if (_currentVote > _newVote) {
            _checkMinConsensus(uint8(_currentVote) - uint8(_newVote));
        }
        if (_currentAccount.addr != _newAccount.addr) {
            delete ownerVote[_currentAccount.addr];
        }
        ownerCounter[_currentVote]--;
        ownerCounter[_newVote]++;
        ownerVote[_newAccount.addr] = _newVote;
    }

    function _checkMinConsensus(uint8 _deduction) private view {
        require(getRequiredVotesForConsensus(_deduction) >= minLimitForConsensus, 'Violate min limit for consensus');
    }
}

// notOwner address - 0x4f8AE33355e0FC889d1A034D636870C6F302812b

// Consensus Ratio - 66
// Min Limit for Consensus - 3
// Initial Owners(two CEOs, thress Devs) - [["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", 2],["0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", 1], ["0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB", 1], ["0x617F2E2fD72FD9D5503197092aC168c91465E7f2", 1]]
// Initial Owners(two CEOs, one Dev) - [["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", 2],["0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", 1]]

// Dummy byte32 - 0x0000000000000000000000000000000000000000000000000000000000000000
// Dummy Account Tuple - ["0x0000000000000000000000000000000000000000", 0]
