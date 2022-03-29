// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;
import './OmnuumNFT1155.sol';
import './OmnuumVRFManager.sol';
import './OmnuumCAManager.sol';

contract RevealManager {
    OmnuumCAManager private caManager;

    constructor(OmnuumCAManager _caManager) {
        caManager = _caManager;
    }

    function vrfRequest(OmnuumNFT1155 _nftContract) external payable {
        /// @custom:error (OO1) - Ownable: Caller is not the collection owner
        require(_nftContract.owner() == msg.sender, 'OO1');

        /// @custom:error (SE6) - NFT already revealed
        require(!_nftContract.isRevealed(), 'SE6');

        OmnuumVRFManager(caManager.getContract('VRF')).requestVRFOnce{ value: msg.value }(address(_nftContract));
    }
}
