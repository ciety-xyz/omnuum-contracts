// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
import './OmnuumNFT1155.sol';
import './OmnuumVRFManager.sol';
import './OmnuumCAManager.sol';

contract RevealManager {
    OmnuumCAManager caManager;

    event Reveal(address nftContract, uint256 num);

    constructor(address _caManager) {
        caManager = OmnuumCAManager(_caManager);
    }

    function vrfRequest(address _nftContract) external payable {
        require(OmnuumNFT1155(_nftContract).owner() == msg.sender, 'OO1');
        require(!OmnuumNFT1155(_nftContract).isRevealed(), 'ARG2');

        OmnuumVRFManager(caManager.getContract('VRF')).requestVRFOnce{ value: msg.value }();
    }

    function vrfResponse(address _nftContract, uint256 _num) external {
        require(msg.sender == caManager.getContract('VRF'));
        emit Reveal(_nftContract, _num);
    }
}
