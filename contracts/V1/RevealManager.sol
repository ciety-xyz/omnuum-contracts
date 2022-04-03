// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import './OmnuumNFT1155.sol';
import './OmnuumVRFManager.sol';
import './OmnuumCAManager.sol';

/// @title RevealManager - simple proxy for reveal call
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice prevent direct call to VRF manager. separate concern from NFT contract and VRF contract
contract RevealManager {
    OmnuumCAManager private caManager;

    constructor(OmnuumCAManager _caManager) {
        caManager = _caManager;
    }

    /// @notice vrf request proxy function
    /// @dev check that msg.sender is owner of nft contract and nft is revealed or not
    /// @param _nftContract nft contract address
    function vrfRequest(OmnuumNFT1155 _nftContract) external payable {
        /// @custom:error (OO1) - Ownable: Caller is not the collection owner
        require(_nftContract.owner() == msg.sender, 'OO1');

        /// @custom:error (SE6) - NFT already revealed
        require(!_nftContract.isRevealed(), 'SE6');

        OmnuumVRFManager(caManager.getContract('VRF')).requestVRFOnce{ value: msg.value }(address(_nftContract), 'REVEAL_PFP');
    }
}
