// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// @title OmnuumWalletAdv - Allows multiple owners to agree on withdraw money, add/remove/change owners before execution.
// @notice This contract is not managed by Omnuum admin, but for owners.
// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
// @version V1

contract OmnuumWalletAdv {
    uint256 immutable consensusRatio;
    uint8 immutable minLimitForConsensus;

    enum RequestType {
        Withdraw, // =0,
        Add, // =1,
        Remove, // =2,
        Change, // =3
        Cancel // =4
    }
    enum OwnerLevel {
        F, // =0,  F-level: 0 vote
        D, // =1,  D-level: 1 vote
        C // =2,  C-level: 2 votes
    }
    struct OwnerAccount {
        address addr;
        OwnerLevel level;
    }
    struct Request {
        address requester;
        RequestType requestType;
        OwnerAccount currentOwner;
        OwnerAccount newOwner;
        uint256 withdrawalAmount;
        mapping(address => bool) voters;
        uint256 votes;
        bool isExecute;
    }
    Request[] public requests;

    mapping(OwnerLevel => uint8) public ownerCounter;
    mapping(address => OwnerLevel) ownerLevel;

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
            OwnerLevel _level = _initialOwnerAccounts[i].level;
            ownerLevel[_initialOwnerAccounts[i].addr] = _level;
            ownerCounter[_level]++;
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
        require(isOwner(_addr) && uint8(ownerLevel[_addr]) == uint8(_ownerAccount.level), 'Account not exist');
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

    modifier notExecuteOrCanceled(uint256 _reqId) {
        require(!requests[_reqId].isExecute, 'Already executed');
        require(requests[_reqId].requestType != RequestType.Cancel, 'Request canceled');
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
     *   Functions - public, external
     * *****************************************************************************/

    function makePayment(bytes32 _topic, string calldata _description) external payable {
        require(msg.value > 0, 'Useless payment');
        emit PaymentReceived(_topic, _description);
    }

    receive() external payable {
        emit EtherReceived();
    }

    function request(
        RequestType _requestType,
        OwnerAccount memory _currentOwnerAccount,
        OwnerAccount memory _newOwnerAccount,
        uint256 _withdrawalAmount
    ) public onlyOwner(msg.sender) returns (uint256 reqId) {
        require(_requestType != RequestType.Cancel, 'Canceled request not acceptable');
        address _requester = msg.sender;
        OwnerLevel _level = ownerLevel[_requester];

        Request storage _newReq = requests.push();
        _newReq.requester = msg.sender;
        _newReq.requestType = _requestType;

        _newReq.currentOwner = OwnerAccount({ addr: _currentOwnerAccount.addr, level: _currentOwnerAccount.level });
        _newReq.newOwner = OwnerAccount({ addr: _newOwnerAccount.addr, level: _newOwnerAccount.level });

        _newReq.withdrawalAmount = _withdrawalAmount;
        _newReq.voters[msg.sender] = true;
        _newReq.votes = uint8(_level);

        // emit
        reqId = requests.length - 1;
    }

    function cancelRequest(uint256 _reqId) public reqExists(_reqId) notExecuteOrCanceled(_reqId) onlyRequester(_reqId) {
        requests[_reqId].requestType = RequestType.Cancel;
    }

    function approve(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecuteOrCanceled(_reqId) notVoted(_reqId) {
        OwnerLevel _level = ownerLevel[msg.sender];
        Request storage _request = requests[_reqId];
        _request.voters[msg.sender] = true;
        _request.votes += uint256(_level);

        //emit
    }

    function revoke(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecuteOrCanceled(_reqId) voted(_reqId) {
        OwnerLevel _level = ownerLevel[msg.sender];
        Request storage _request = requests[_reqId];
        delete _request.voters[msg.sender];
        _request.votes -= uint256(_level);
    }

    function execute(uint256 _reqId) public reqExists(_reqId) notExecuteOrCanceled(_reqId) onlyRequester(_reqId) reachConsensus(_reqId) {
        Request storage _request = requests[_reqId];
        uint8 _type = uint8(_request.requestType);
        _request.isExecute = true;

        if (_type == uint8(RequestType.Withdraw)) {
            _withdraw(_request.withdrawalAmount, _request.requester);
        } else if (_type == uint8(RequestType.Add)) {
            _addOwner(_request.newOwner);
        } else if (_type == uint8(RequestType.Remove)) {
            _removeOwner(_request.currentOwner);
        } else if (_type == uint8(RequestType.Change)) {
            _changeOwner(_request.currentOwner, _request.newOwner);
        } else {
            revert('Unrecognized request');
        }
    }

    function totalVotes() public view returns (uint256 votes) {
        votes = ownerCounter[OwnerLevel.D] + 2 * ownerCounter[OwnerLevel.C];
    }

    function isOwner(address _owner) public view returns (bool isValid) {
        isValid = uint8(ownerLevel[_owner]) > 0;
    }

    function getVoteCounts(address _owner) public view returns (uint256 votes) {
        votes = uint8(ownerLevel[_owner]);
    }

    function amIVoted(uint256 _reqId) public view reqExists(_reqId) returns (bool isValid) {
        isValid = requests[_reqId].voters[msg.sender];
    }

    function getRequiredVotesForConsensus(uint8 _deduction) public view returns (uint256 votesForConsensus) {
        votesForConsensus = ((totalVotes() - _deduction) * consensusRatio) / 100;
    }

    /* *****************************************************************************
     *   Functions - internal, private
     * *****************************************************************************/

    function _withdraw(uint256 _withdrawalAmount, address _to) private {
        require(_withdrawalAmount <= address(this).balance, 'Insufficient balance');
        (bool withdrawn, ) = payable(_to).call{ value: _withdrawalAmount }('');
        require(withdrawn, 'Address: unable to send value, recipient may have reverted');
    }

    function _addOwner(OwnerAccount memory _newAccount) private notOwner(_newAccount.addr) isValidAddress(_newAccount.addr) {
        OwnerLevel _level = _newAccount.level;
        ownerLevel[_newAccount.addr] = _level;
        ownerCounter[_level]++;
    }

    function _removeOwner(OwnerAccount memory _removalAccount) private isOwnerAccount(_removalAccount) {
        _checkMinConsensus(uint8(ownerLevel[_removalAccount.addr]));
        ownerCounter[_removalAccount.level]--;
        delete ownerLevel[_removalAccount.addr];
    }

    function _changeOwner(OwnerAccount memory _currentAccount, OwnerAccount memory _newAccount) private {
        //        require(!_isMatchAccount(_currentAccount, _newAccount), 'same account substitution');
        OwnerLevel _currentLevel = _currentAccount.level;
        OwnerLevel _newLevel = _newAccount.level;

        require(_newLevel != OwnerLevel.F, 'F level not acceptable');
        if (_currentLevel > _newLevel) {
            _checkMinConsensus(uint8(_currentLevel) - uint8(_newLevel));
        }
        if (_currentAccount.addr != _newAccount.addr) {
            delete ownerLevel[_currentAccount.addr];
        }
        ownerCounter[_currentLevel]--;
        ownerCounter[_newLevel]++;
        ownerLevel[_newAccount.addr] = _newLevel;
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
