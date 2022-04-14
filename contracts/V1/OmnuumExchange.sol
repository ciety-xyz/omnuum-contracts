// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '../utils/OwnableUpgradeable.sol';
import './OmnuumCAManager.sol';

/// @title OmnuumExchange - Omnuum internal exchange contract to use token freely by other omnuum contracts
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Use only purpose for Omnuum
/// @dev Warning:: This contract is for temporary use and will be upgraded to version 2 which use dex to exchange token,
/// @dev Until version 2, LINK token will be deposited this contract directly and send LINK to omnuum contracts whenever they want
contract OmnuumExchange is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    OmnuumCAManager private caManager;

    /// @notice temporary use purpose of LINK/ETH exchange rate
    uint256 public tmpLinkExRate;

    event Exchange(address indexed baseToken, address indexed targetToken, uint256 amount, address user, address indexed receipient);

    function initialize(address _caManagerA) public initializer {
        /// @custom:error (AE1) - Zero address not acceptable
        require(_caManagerA != address(0), 'AE1');

        __Ownable_init();

        caManager = OmnuumCAManager(_caManagerA);

        tmpLinkExRate = 0.01466666666 ether;
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
    function updateTmpExchangeRate(uint256 _newRate) external onlyOwner {
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
    ) external payable {
        /// @custom:error (OO7) - Only role owner can access
        require(caManager.hasRole(msg.sender, 'EXCHANGE'), 'OO7');

        IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);

        emit Exchange(address(0), _token, _amount, msg.sender, _to);
    }

    /// @notice withdraw specific amount to omnuum wallet contract
    /// @param _amount amount of ether to be withdrawn
    function withdraw(uint256 _amount) external onlyOwner {
        /// @custom:error (ARG2) - Arguments are not correct
        require(_amount <= address(this).balance, 'ARG2');
        payable(caManager.getContract('WALLET')).transfer(_amount);
    }
}
