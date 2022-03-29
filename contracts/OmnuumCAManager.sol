// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract OmnuumCAManager is OwnableUpgradeable {
    struct Contract {
        string topic;
        bool active;
    }

    mapping(address => Contract) public contracts;
    mapping(string => address) public indexedContracts;

    // actionType: register, remove
    event Updated(address indexed contractAccount, Contract, string indexed actionType);

    function initialize() public initializer {
        __Ownable_init();
    }

    function registerContractMultiple(address[] calldata CAs, string[] calldata topics) external onlyOwner {
        require(CAs.length == topics.length, 'length unmatched');
        for (uint256 i = 0; i < CAs.length; i++) {
            registerContract(CAs[i], topics[i]);
        }
    }

    function registerContract(address CA, string calldata topic) public onlyOwner {
        contracts[CA] = Contract(topic, true);
        indexedContracts[topic] = CA;
        emit Updated(CA, contracts[CA], 'register');
    }

    function removeContract(address CA) external onlyOwner {
        emit Updated(CA, contracts[CA], 'remove');

        string memory topic = contracts[CA].topic;
        delete contracts[CA];

        if (indexedContracts[topic] == CA) {
            delete indexedContracts[topic];
        }
    }

    function isRegistered(address CA) public view returns (bool) {
        return contracts[CA].active;
    }

    function getContract(string calldata topic) public view returns (address) {
        return indexedContracts[topic];
    }
}
