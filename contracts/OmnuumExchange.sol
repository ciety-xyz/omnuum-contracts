// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './interfaces/IOmnuumExchange.sol';
import './OmnuumCAManager.sol';
import 'hardhat/console.sol';

// in future, this contract will act like internal token exchange for business
contract OmnuumExchange is OwnableUpgradeable {
    OmnuumCAManager caManager;

    uint256 tmpLinkExRate;

    event Exchange(address baseToken, address targetToken, uint256 amount, address user, address receipient);

    function initialize(address _caMAnagerA) public initializer {
        __Ownable_init();

        caManager = OmnuumCAManager(_caMAnagerA);

        tmpLinkExRate = 0.006 ether; // TODO: should change before deploy
    }

    function deposit() public payable {
        console.log('recevied %s', msg.value);
    }

    // temporary function for fixed link exchange rate -
    function getExchangeRate(
        address _baseToken,
        address _targetToken,
        uint256 _amount
    ) public view returns (uint256) {
        return tmpLinkExRate * _amount;
    }

    function updateTmpExchangeRate(uint256 _newRate) public {
        require(caManager.isRegistered(msg.sender), 'OO3');
        tmpLinkExRate = _newRate;
    }

    // @dev exchange with ether, only receive token
    function exchangeToken(
        address _token,
        uint256 _amount,
        address _to
    ) public payable {
        require(caManager.isRegistered(msg.sender), 'OO3');

        ERC20(_token).transfer(msg.sender, _amount);

        emit Exchange(address(0), _token, _amount, msg.sender, _to);
    }

    function withdraw() public {
        console.log('Send!! to: %s, amount: %s', msg.sender, address(this).balance);
        require(caManager.isRegistered(msg.sender), 'OO3');
        payable(msg.sender).transfer(address(this).balance);
    }
}
