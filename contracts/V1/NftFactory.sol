// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';
import '../utils/Ownable.sol';
import './OmnuumCAManager.sol';
import './SenderVerifier.sol';

/// @title NftFactory - Factory contract for deploying new NFT PFP projects for creators
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
contract NftFactory is Ownable {
    event NftContractDeployed(address indexed nftContract, address indexed creator, uint256 indexed collectionId);

    address public immutable caManager;
    address public immutable nftContractBeacon;
    address public omnuumSigner;

    /// @notice constructor
    /// @param _caManager CA manager address managed by Omnuum
    /// @param _nftContractBeacon Nft contract beacon address managed by Omnuum
    /// @param _omnuumSigner Address of Omnuum signer for creating and verifying off-chain ECDSA signature
    constructor(
        address _caManager,
        address _nftContractBeacon,
        address _omnuumSigner
    ) Ownable() {
        caManager = _caManager;
        omnuumSigner = _omnuumSigner;
        nftContractBeacon = _nftContractBeacon;
    }

    /// @notice deploy
    /// @param _maxSupply max amount can be minted
    /// @param _coverUri metadata uri for before reveal
    /// @param _collectionId collection id
    /// @param _payload payload for signature to verify collection id
    function deploy(
        uint32 _maxSupply,
        string calldata _coverUri,
        uint256 _collectionId,
        SenderVerifier.Payload calldata _payload
    ) external {
        address senderVerifier = OmnuumCAManager(caManager).getContract('VERIFIER');
        SenderVerifier(senderVerifier).verify(omnuumSigner, msg.sender, 'DEPLOY_COL', _collectionId, _payload);

        bytes memory data = abi.encodeWithSignature(
            'initialize(address,address,uint32,string,address)',
            caManager,
            omnuumSigner,
            _maxSupply,
            _coverUri,
            msg.sender
        );

        BeaconProxy beacon = new BeaconProxy(nftContractBeacon, data);
        emit NftContractDeployed(address(beacon), msg.sender, _collectionId);
    }

    /// @notice changeOmnuumSigner
    /// @param _newSigner Address of Omnuum signer for replacing previous signer
    function changeOmnuumSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), 'AE1');
        omnuumSigner = _newSigner;
    }
}
