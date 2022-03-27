// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '../utils/OwnableUpgradeable.sol';

contract OmnuumCAManager is OwnableUpgradeable {
    struct Contract {
        string topic;
        bool active;
    }

    mapping(address => bool) public nftContracts;
    mapping(address => Contract) managerContracts;
    mapping(string => address) indexedContracts;

    event NftContractRegistered(address nftContract, address nftOwner);
    event ManagerContractRegistered(address managerContract, bytes32 topic);
    event ManagerContractRemoved(address managerContract, bytes32 topic);

    function initialize() public initializer {
        __Ownable_init();
    }

    function registerContractMultiple(address[] calldata CAs, string[] calldata topics) public onlyOwner {
        require(CAs.length == topics.length, 'length unmatched');
        for (uint256 i; i < CAs.length; i++) {
            registerContract(CAs[i], topics[i]);
        }
    }

    function registerNftContract(address _nftContract, address _initialOwner) public onlyOwner {
        nftContracts[_nftContract] = true;
        emit NftContractRegistered(_nftContract, _initialOwner);
    }

    function registerContract(address CA, string calldata topic) public onlyOwner {
        managerContracts[CA] = Contract(topic, true);
        indexedContracts[topic] = CA;
        emit ManagerContractRegistered(CA, keccak256(abi.encodePacked(topic)));
    }

    function removeContract(address CA) public onlyOwner {
        string memory topic = managerContracts[CA].topic;
        delete managerContracts[CA];

        if (indexedContracts[topic] == CA) {
            delete indexedContracts[topic];
        }

        emit ManagerContractRemoved(CA, keccak256(abi.encodePacked(topic)));
    }

    function isRegistered(address CA) public view returns (bool) {
        return managerContracts[CA].active;
    }

    function getContract(string calldata topic) public view returns (address) {
        return indexedContracts[topic];
    }
}
