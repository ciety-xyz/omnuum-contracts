// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

//import '@openzeppelin/contracts/utils/Address.sol';
import 'hardhat/console.sol';

// @title OmnuumWallet - Allows multiple owners to agree on withdraw money before execution
// @notice This contract is managed by Omnuum admin
// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
// @version V1

contract OmnuumWalletAdv {
    uint256 constant consensusRatio = 66; // 2 of 3 Multi-sig Wallet

    uint8 cLevelOwners;
    uint8 dLevelOwners;

    enum Level {
        F, // = 0,  F-level: 0 vote
        D, // = 1,  D-level: 1 vote
        C // = 2,  C-level: 2 votes
    }

    enum OwnerChangeType {
        Add,
        Remove,
        Change
    }

    struct OwnerAccount {
        address owner;
        Level level;
    }

    struct ReqOwnerChange {
        address requester;
        OwnerChangeType requestType;
        address currentOwner;
        address newOwner;
        mapping(address => bool) voters;
        uint256 voteCount;
        bool isExecute;
    }

    ReqOwnerChange[] public reqOwnerChanges;

    mapping(Level => uint8) public levelCounters;
    mapping(address => Level) owners;

    constructor(OwnerAccount[] memory _initialOwners) {
        for (uint256 i; i < _initialOwners.length; i++) {
            address _owner = _initialOwners[i].owner;
            Level _level = _initialOwners[i].level;
            owners[_owner] = _level;
            levelCounters[_level]++;
        }
    }

    /* *****************************************************************************
     * Modifiers
     * *****************************************************************************/
    modifier onlyOwner() {
        require(isOwner(msg.sender), 'not owner');
        _;
    }

    modifier minConsensus(Level _deduction) {
        console.log('total_votes', getTotalVotes(_deduction));
        uint256 votesForConsensus = (getTotalVotes(_deduction) * consensusRatio) / 100;
        console.log('votesForConsensus', votesForConsensus);
        console.log('Level.C', uint256(Level.C));
        require(votesForConsensus > uint256(Level.C), 'violate the minimum consensus voters');
        _;
    }

    /* *****************************************************************************
     * Functions - public, external
     * *****************************************************************************/

    function requestForOwnerChange(
        OwnerChangeType _requestType,
        address _currentOwner,
        address _newOwner
    ) public onlyOwner returns (uint256 reqId) {
        address _requester = msg.sender;
        Level _level = owners[_requester];

        ReqOwnerChange storage _newReq = reqOwnerChanges.push();
        _newReq.requester = msg.sender;
        _newReq.requestType = _requestType;
        _newReq.currentOwner = _requestType == OwnerChangeType.Add ? address(0) : _currentOwner;
        _newReq.newOwner = _requestType == OwnerChangeType.Remove ? address(0) : _newOwner;
        _newReq.voters[msg.sender] = true;
        _newReq.voteCount = uint8(_level);

        // emit
        reqId = reqOwnerChanges.length - 1;
    }

    function approveForOwnerChange(uint256 reqId) public onlyOwner {
        require(_reqId < reqOwnerChanges.length, 'request not exists');
        require(!reqOwnerChanges[_reqId].isExecute, 'already executed');
        require(!reqOwnerChanges[_reqId].voters[msg.sender], 'already voted');

        Level _level = owners[msg.sender];
        ReqOwnerChange storage _request = reqOwnerChanges[reqId];
        _request.voters[msg.sender] = true;
        _request.voteCount += uint256(_level);

        //emit
    }

    function getTotalVotes(Level _deduction) public view returns (uint256 totalVotes) {
        totalVotes = levelCounters[Level.D] + 2 * levelCounters[Level.C] - uint8(_deduction);
    }

    function isOwner(address _owner) public view returns (bool isOwner) {
        isOwner = owners[_owner] > 0;
    }

    /* *****************************************************************************
     * Functions - internal, private
     * *****************************************************************************/

    // internal 로 변경
    function _removeOwner(address _owner) public onlyOwner minConsensus(owners[_owner]) {
        levelCounters[owners[_owner]]--;
        owners[_owner] = Level.F;
    }

    function test(Level _level) public minConsensus(_level) {}
}

// [["0xF891E5556686b588269762d59466451FD7cE49B9", 2],["0xE8B67856F9f9Fc97b135139759ce575dB19dA5b1", 2],["0x8D1907Df4f7a2B740604b83Bc17b26C17ec3b299", 1], ["0xe36E03aCcA573DE10994a8c483427c659dE79bAd", 1], ["0x3cdc1AbE8D70B7A1f3Cc8c974706e8924C6AC349", 1]]
// notOwner 0x4f8AE33355e0FC889d1A034D636870C6F302812b

// [["0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 2],["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", 2],["0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db", 1], ["0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB", 1], ["0x617F2E2fD72FD9D5503197092aC168c91465E7f2", 1]]
