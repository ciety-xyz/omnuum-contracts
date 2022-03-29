// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '../OmnuumVRFManager.sol';

contract MockVrfRequester {
    constructor() {}

    function requestVRF(address _vrfManager) public {
        OmnuumVRFManager(_vrfManager).requestVRF();
    }

    function requestVRFOnce(address _vrfManager, address _targetAddress) public payable {
        OmnuumVRFManager(_vrfManager).requestVRFOnce{ value: msg.value }(_targetAddress);
    }
}
