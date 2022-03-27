// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

// @title OmnuumWallet - Allows multiple owners to agree on withdraw money before execution
// @notice This contract is managed by Omnuum admin
// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
// @version V1

contract OmnuumWalletAdv {
    uint256 immutable consensusRatio;
    uint8 immutable minLimitForConsensus;

    enum Level {
        F, // = 0,  F-level: 0 vote
        D, // = 1,  D-level: 1 vote
        C // = 2,  C-level: 2 votes
    }

    enum RequestType {
        Withdraw, // =0,
        Add, // =1,
        Remove, // =2,
        Change, // =3
        Cancel // =4
    }

    struct OwnerAccount {
        address addr;
        Level level;
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

    mapping(Level => uint8) public levelCounters;
    mapping(address => Level) owners;

    constructor(
        uint256 _consensusRatio,
        uint8 _minLimitForConsensus,
        OwnerAccount[] memory _initialOwners
    ) {
        consensusRatio = _consensusRatio;
        minLimitForConsensus = _minLimitForConsensus;

        for (uint256 i; i < _initialOwners.length; i++) {
            address _owner = _initialOwners[i].addr;
            Level _level = _initialOwners[i].level;
            owners[_owner] = _level;
            levelCounters[_level]++;
        }
    }

    /* *****************************************************************************
     * Events
     * *****************************************************************************/
    event PaymentReceived(bytes32 indexed topic, string description);
    event EtherReceived();

    /* *****************************************************************************
     * Modifiers
     * *****************************************************************************/
    modifier onlyOwner(address _address) {
        require(isOwner(_address), 'not owner');
        _;
    }

    modifier notOwner(address _address) {
        require(!isOwner(_address), 'already owner');
        _;
    }

    modifier isOwnerAccount(OwnerAccount memory _ownerAccount) {
        address _addr = _ownerAccount.addr;
        require(isOwner(_addr) && uint8(owners[_addr]) == uint8(_ownerAccount.level), 'account not exist');
        _;
    }

    modifier onlyRequester(uint256 _reqId) {
        require(requests[_reqId].requester == msg.sender, 'only requester');
        _;
    }

    modifier reachConsensus(uint256 _reqId) {
        require(requests[_reqId].votes >= getRequiredVotesForConsensus(0), 'not reach consensus');
        _;
    }

    modifier reqExists(uint256 _reqId) {
        require(_reqId < requests.length, 'request not exists');
        _;
    }

    modifier notExecutedOrCanceled(uint256 _reqId) {
        require(!requests[_reqId].isExecute, 'already executed');
        require(requests[_reqId].requestType != RequestType.Cancel, 'request canceled');
        _;
    }

    modifier notVoted(uint256 _reqId) {
        require(!amIVoted(_reqId), 'already voted');
        _;
    }

    modifier voted(uint256 _reqId) {
        require(amIVoted(_reqId), 'already voted');
        _;
    }

    modifier isValidAddress(address _address) {
        require(_address != address(0), 'zero address not acceptable');
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_address)
        }
        require(codeSize == 0, 'CA address not acceptable'); // know that it's not perfect to protect, but can handle by the owners
        _;
    }

    /* *****************************************************************************
     * Functions - public, external
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
        require(_requestType != RequestType.Cancel, 'canceled request not acceptable');
        address _requester = msg.sender;
        Level _level = owners[_requester];

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

    function cancelRequest(uint256 _reqId) public reqExists(_reqId) notExecutedOrCanceled(_reqId) onlyRequester(_reqId) {
        requests[_reqId].requestType = RequestType.Cancel;
    }

    function approve(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecutedOrCanceled(_reqId) notVoted(_reqId) {
        Level _level = owners[msg.sender];
        Request storage _request = requests[_reqId];
        _request.voters[msg.sender] = true;
        _request.votes += uint256(_level);

        //emit
    }

    function revoke(uint256 _reqId) public onlyOwner(msg.sender) reqExists(_reqId) notExecutedOrCanceled(_reqId) voted(_reqId) {
        Level _level = owners[msg.sender];
        Request storage _request = requests[_reqId];
        delete _request.voters[msg.sender];
        _request.votes -= uint256(_level);
    }

    function execute(uint256 _reqId) public reqExists(_reqId) notExecutedOrCanceled(_reqId) onlyRequester(_reqId) reachConsensus(_reqId) {
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
            revert('unrecognized request');
        }
    }

    function totalVotes() public view returns (uint256 votes) {
        votes = levelCounters[Level.D] + 2 * levelCounters[Level.C];
    }

    function isOwner(address _owner) public view returns (bool isValid) {
        isValid = uint8(owners[_owner]) > 0;
    }

    function getVoteCounts(address _owner) public view returns (uint256 votes) {
        votes = uint8(owners[_owner]);
    }

    function amIVoted(uint256 _reqId) public view reqExists(_reqId) returns (bool isValid) {
        isValid = requests[_reqId].voters[msg.sender];
    }

    function getRequiredVotesForConsensus(uint8 _deduction) public view returns (uint256 votesForConsensus) {
        votesForConsensus = ((totalVotes() - _deduction) * consensusRatio) / 100;
    }

    /* *****************************************************************************
     * Functions - internal, private
     * *****************************************************************************/

    function _withdraw(uint256 _withdrawalAmount, address _to) private {
        require(_withdrawalAmount <= address(this).balance, 'insufficient balance');
        (bool withdrawn, ) = payable(_to).call{ value: _withdrawalAmount }('');
        require(withdrawn, 'Address: unable to send value, recipient may have reverted');
    }

    function _addOwner(OwnerAccount memory _newAccount) private notOwner(_newAccount.addr) isValidAddress(_newAccount.addr) {
        Level _level = _newAccount.level;
        owners[_newAccount.addr] = _level;
        levelCounters[_level]++;
    }

    function _removeOwner(OwnerAccount memory _removalAccount) private isOwnerAccount(_removalAccount) {
        _checkMinConsensus(uint8(owners[_removalAccount.addr]));
        levelCounters[_removalAccount.level]--;
        delete owners[_removalAccount.addr];
    }

    function _changeOwner(OwnerAccount memory _currentAccount, OwnerAccount memory _newAccount) private {
        //        require(!_isMatchAccount(_currentAccount, _newAccount), 'same account substitution');
        Level _currentLevel = _currentAccount.level;
        Level _newLevel = _newAccount.level;

        require(_newLevel != Level.F, 'F level not acceptable');
        if (_currentLevel > _newLevel) {
            _checkMinConsensus(uint8(_currentLevel) - uint8(_newLevel));
        }
        if (_currentAccount.addr != _newAccount.addr) {
            delete owners[_currentAccount.addr];
        }
        levelCounters[_currentLevel]--;
        levelCounters[_newLevel]++;
        owners[_newAccount.addr] = _newLevel;
    }

    //    function _isMatchAccount(OwnerAccount memory _A, OwnerAccount memory _B) private pure returns (bool isMatch) {
    //        isMatch = (_A.addr == _B.addr && _A.level == _B.level);
    //    }

    function _checkMinConsensus(uint8 _deduction) private view {
        require(getRequiredVotesForConsensus(_deduction) >= minLimitForConsensus, 'violate min limit for consensus');
    }

    function test(OwnerAccount memory _ownerAccount) public {}
}

// notOwner address: 0x4f8AE33355e0FC889d1A034D636870C6F302812b

// two CEOs, thress Devs: [["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", 2],["0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", 1], ["0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB", 1], ["0x617F2E2fD72FD9D5503197092aC168c91465E7f2", 1]]
// two CEOs, one Dev: [["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", 2],["0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", 1]]

// Dummy byte32: 0x0000000000000000000000000000000000000000000000000000000000000000
// Dummy Account Tuple: ["0x0000000000000000000000000000000000000000", 0]
