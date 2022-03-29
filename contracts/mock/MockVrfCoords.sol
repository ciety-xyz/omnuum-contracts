// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@chainlink/contracts/src/v0.8/VRFConsumerBase.sol';

contract MockVrfCoords {
    constructor() {}

    function sendRandom(
        address _vrfManager,
        bytes32 requestId,
        uint256 randomness
    ) public {
        VRFConsumerBase(_vrfManager).rawFulfillRandomness(requestId, randomness);
    }
}
