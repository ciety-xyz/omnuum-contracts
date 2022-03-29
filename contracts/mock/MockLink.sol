// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

contract MockLink {
    uint256 bal = 10 ether;

    function changeBalance(uint256 _bal) public {
        bal = _bal;
    }

    function balanceOf(address) public view returns (uint256) {
        return bal;
    }

    function transfer(address _to, uint256 value) public returns (bool) {
        return true;
    }

    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool success) {
        return true;
    }
}
