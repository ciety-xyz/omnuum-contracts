// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract OmnuumCAManager is OwnableUpgradeable {
    struct Contract {
        string topic;
        bool active;
    }

    mapping(address => Contract) contracts;
    mapping(string => address) indexedContracts;

    // actionType: register, remove
    event Updated(address, Contract, string actionType);

    function initialize() public initializer {
        __Ownable_init();
    }

    function registerContractMultiple(address[] calldata CAs, string[] calldata topics) public onlyOwner {
        require(CAs.length == topics.length, 'length unmatched');
        for (uint256 i; i < CAs.length; i++) {
            registerContract(CAs[i], topics[i]);
        }
    }

    function registerContract(address CA, string calldata topic) public onlyOwner {
        contracts[CA] = Contract(topic, true);
        indexedContracts[topic] = CA;
        emit Updated(CA, contracts[CA], 'register');
    }

    function removeContract(address CA) public onlyOwner {
        emit Updated(CA, contracts[CA], 'remove');

        string memory topic = contracts[CA].topic;
        delete contracts[CA];

        if (indexedContracts[topic] == CA) {
            delete indexedContracts[topic];
        }
    }

    function isRegistered(address CA) external view returns (bool) {
        return contracts[CA].active;
    }

    function getContract(string calldata topic) public view returns (address) {
        return indexedContracts[topic];
    }
}
