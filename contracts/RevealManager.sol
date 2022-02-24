// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
import './OmnuumNFT1155.sol';
import './OmnuumVRFManager.sol';
import './OmnuumCAManager.sol';

contract RevealManager {
    OmnuumCAManager caManager;

    constructor(OmnuumCAManager _caManager) {
        caManager = _caManager;
    }

    function vrfRequest(OmnuumNFT1155 _nftContract) external payable {
        require(_nftContract.owner() == msg.sender, 'OO1');
        require(!_nftContract.isRevealed(), 'ARG2');

        OmnuumVRFManager(caManager.getContract('VRF')).requestVRFOnce{ value: msg.value }(address(_nftContract));
    }
}
