// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

interface IOmnuumExchange {
    function initialize(address _caMAnagerA) external;

    event Exchange(address baseToken, address targetToken, uint256 amount, address user, address receipient);

    function deposit() external payable;

    // temporary function for fixed link exchange rate -
    function getExchangeRate(
        address _baseToken,
        address _targetToken,
        uint256 _amount
    ) external returns (uint256);

    function updateTmpExchangeRate(uint256 _newRate) external;

    function exchangeToken(
        address _baseToken,
        address _targetToken,
        uint256 _amount,
        address _to
    ) external payable;

    // @dev exchange with ether, _fromEther: 0 or 1, 0 - exchange to ether, 1 - exchange from ether
    function exchangeToken(
        address _token,
        uint256 _amount,
        address _to,
        uint8 _fromEther
    ) external payable;

    function withdraw() external;
}
