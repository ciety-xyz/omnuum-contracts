// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import './utils/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol';


/// @title OmnuumCAManager - Contract Manager for Omnuum Protocol
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Use only purpose for Omnuum
contract OmnuumCAManager is OwnableUpgradeable {
    using AddressUpgradeable for address;

    struct Contract {
        string topic;
        bool active;
    }

    /// @notice (omnuum contract address => (bytes32 topic => isRegistered))
    mapping(address => mapping(bytes32 => bool)) public roles;

    /// @notice (omnuum contract address => (topic, active))
    mapping(address => Contract) public contracts;

    // @notice topic indexed mapping, (string topic => omnuum contract address)
    mapping(string => address) public indexedContracts;

    // actionType: register, remove
    event Updated(address indexed contractAccount, Contract, string indexed actionType);
    event RoleAdded(address ca, string role);
    event RoleRemoved(address ca, string role);

    function initialize() public initializer {
        __Ownable_init();
    }

    /// @notice Add role to multiple addresses
    /// @param _CAs list of contract address which will have specified role
    /// @param _role role name to grant permission
    function addRole(address[] calldata _CAs, string calldata _role) external onlyOwner {
        uint256 len = _CAs.length;
        bytes32 role = keccak256(abi.encodePacked(_role));
        for (uint256 i; i < len; i++) {
            roles[_CAs[i]][role] = true;
            emit RoleAdded(_CAs[i], _role);
        }
    }

    /// @notice Add role to multiple addresses
    /// @param _CAs list of contract address which will be deprived specified role
    /// @param _role role name to be removed
    function removeRole(address[] calldata _CAs, string calldata _role) external onlyOwner {
        uint256 len = _CAs.length;
        bytes32 role = keccak256(abi.encodePacked(_role));
        for (uint256 i; i < len; i++) {
            roles[_CAs[i]][role] = false;
            emit RoleRemoved(_CAs[i], _role);
        }
    }

    /// @notice Check whether target address has role or not
    /// @param _target address to be checked
    /// @param _role role name to be checked with
    /// @return whether target address has specified role or not
    function hasRole(address _target, string calldata _role) external returns (bool) {
        return roles[_target][keccak256(abi.encodePacked(_role))];
    }

    /// @notice Register multiple addresses at once
    /// @param _CAs list of contract address which will be registered
    /// @param _topics topic list for each contract address
    function registerContractMultiple(address[] calldata _CAs, string[] calldata _topics) external onlyOwner {
        uint256 len = _CAs.length;
        /// @custom:error (ARG1) - Arguments length should be same
        require(_CAs.length == _topics.length, 'ARG1');
        for (uint256 i = 0; i < len; i++) {
            registerContract(_CAs[i], _topics[i]);
        }
    }

    /// @notice Register contract address with topic
    /// @param _CA contract address
    /// @param _topic topic for address
    function registerContract(address _CA, string calldata _topic) public onlyOwner {
        require(_CA != address(0));

        /// @custom:error (AE2) - Contract address not acceptable
        require(_CA.isContract(), 'AE2');

        contracts[_CA] = Contract(_topic, true);
        indexedContracts[_topic] = _CA;
        emit Updated(_CA, contracts[_CA], 'register');
    }

    /// @notice Check whether contract address is registered
    /// @param _CA contract address
    /// @return isRegistered - boolean
    function checkRegistration(address _CA) external view returns (bool isRegistered) {
        return contracts[_CA].active;
    }

    /// @notice Remove contract address
    /// @param _CA contract address which will be removed
    function removeContract(address _CA) external onlyOwner {
        emit Updated(_CA, contracts[_CA], 'remove');

        string memory topic = contracts[_CA].topic;
        delete contracts[_CA];

        if (indexedContracts[topic] == _CA) {
            delete indexedContracts[topic];
        }
    }

    /// @notice Check whether contract address is registered
    /// @param _CA contract address
    /// @return isRegistered boolean
    function isRegistered(address _CA) public view returns (bool isRegistered) {
        return contracts[_CA].active;
    }

    /// @notice Get contract address for specified topic
    /// @param _topic topic for address
    /// @return address which is registered with topic
    function getContract(string calldata _topic) public view returns (address) {
        return indexedContracts[_topic];
    }
}
