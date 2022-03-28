// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import './OmnuumCAManager.sol';

/// @title OmnuumExchange - Omnuum internal exchange contract to use token freely by other omnuum contracts
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Use only purpose for Omnuum
/// @dev Warning:: This contract is for temporary use and will be upgraded to version 2 which use dex to exchange token,
/// @dev Until version 2, LINK token will be deposited this contract directly and send LINK to omnuum contracts whenever they want
contract OmnuumExchange is OwnableUpgradeable {
    OmnuumCAManager caManager;

    uint256 tmpLinkExRate;

    event Exchange(address baseToken, address targetToken, uint256 amount, address user, address receipient);

    function initialize(address _caManagerA) public initializer {
        __Ownable_init();

        caManager = OmnuumCAManager(_caManagerA);

        tmpLinkExRate = 0.0055 ether; // TODO: should change before deploy
    }

    /// @notice calculate amount when given amount of token is swapped to target token
    /// @param _fromToken 'from' token for swapping
    /// @param _toToken 'to' token for swapping
    /// @param _amount 'from' token's amount for swapping
    /// @return amount 'to' token's expected amount after swapping
    function getExchangeAmount(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) public view returns (uint256 amount) {
        return (tmpLinkExRate * _amount) / 1 ether;
    }

    /// @notice update temporary exchange rate which is used for LINK/ETH
    /// @param _newRate new exchange rate (LINK/ETH)
    function updateTmpExchangeRate(uint256 _newRate) public onlyOwner {
        tmpLinkExRate = _newRate;
    }

    /// @notice give requested token to omnuum contract
    /// @param _token request token address
    /// @param _amount amount of token requested
    /// @param _to address where specified token and amount should delivered to
    function exchangeToken(
        address _token,
        uint256 _amount,
        address _to
    ) public payable {
        require(caManager.hasRole(msg.sender, 'EXCHANGE'), 'OO3');

        IERC20(_token).transfer(msg.sender, _amount);

        emit Exchange(address(0), _token, _amount, msg.sender, _to);
    }

    /// @notice withdraw specific amount to omnuum wallet contract
    /// @param _amount amount of ether to be withdrawn
    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, 'Not enough balance');
        payable(caManager.getContract('WALLET')).transfer(_amount);
    }
}
