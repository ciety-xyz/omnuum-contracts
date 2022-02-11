// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

contract MockLink {
    function balanceOf() public view returns (uint256) {
        return 10 ether;
    }

    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool success) {
        return true;
    }
}
