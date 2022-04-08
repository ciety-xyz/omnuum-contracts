// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '../V1/OmnuumVRFManager.sol';

contract MockVrfRequester {
    constructor() {}

    function requestVRF(address _vrfManager) public payable {
        OmnuumVRFManager(_vrfManager).requestVRF{ value: msg.value }('REVEAL_PFP');
    }

    function requestVRFOnce(address _vrfManager, address _targetAddress) public payable {
        OmnuumVRFManager(_vrfManager).requestVRFOnce{ value: msg.value }(_targetAddress, 'REVEAL_PFP');
    }
}
