// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

contract OmnuumCAManager is OwnableUpgradeable {
    struct Contract {
        string topic;
        bool active;
    }

    mapping(address => bool) nftContracts;
    mapping(address => Contract) managerContracts;
    mapping(string => address) indexedContracts;

    event ContractRegistered(address, bytes32);
    event ContractRemoved(address, bytes32);
    event NftContractRegistered(address);

    function initialize() public initializer {
        __Ownable_init();
    }

    function registerContractMultiple(address[] calldata CAs, string[] calldata topics) public onlyOwner {
        require(CAs.length == topics.length, 'length unmatched');
        for (uint256 i; i < CAs.length; i++) {
            registerContract(CAs[i], topics[i]);
        }
    }

    function registerNftContract(address _nftContract) public onlyOwner {
        nftContracts[_nftContract] = true;
        emit NftContractRegistered(_nftContract);
    }

    function registerContract(address CA, string calldata topic) public onlyOwner {
        managerContracts[CA] = Contract(topic, true);
        indexedContracts[topic] = CA;
        emit ContractRegistered(CA, keccak256(abi.encodePacked(managerContracts[CA].topic)));
    }

    function removeContract(address CA) public onlyOwner {
        string memory topic = managerContracts[CA].topic;
        delete managerContracts[CA];

        if (indexedContracts[topic] == CA) {
            delete indexedContracts[topic];
        }

        emit ContractRemoved(CA, keccak256(abi.encodePacked(managerContracts[CA].topic)));
    }

    function isRegistered(address CA) public view returns (bool) {
        return managerContracts[CA].active;
    }

    function getContract(string calldata topic) public view returns (address) {
        return indexedContracts[topic];
    }
}
