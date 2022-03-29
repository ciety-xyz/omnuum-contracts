// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';

contract SenderVerifier is EIP712 {
    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    string private constant SIGNING_DOMAIN = 'Omnuum';
    string private constant SIGNATURE_VERSION = '1';

    struct Payload {
        address sender;
        string topic;
        uint256 nounce;
        bytes signature;
    }

    function verify(
        address _owner,
        address _sender,
        string calldata _topic,
        uint256 _nounce,
        Payload calldata _payload
    ) public view {
        address signer = recoverSigner(_payload);

        /// @custom:error (VR1) - False Signer
        require(_owner == signer, 'VR1');

        /// @custom:error (VR2) - False Nounce
        require(_nounce == _payload.nounce, 'VR2');

        /// @custom:error (VR3) - False Topic
        require(keccak256(abi.encodePacked(_payload.topic)) == keccak256(abi.encodePacked(_topic)), 'VR3');

        /// @custom:error (VR4) - False Sender
        require(_payload.sender == _sender, 'VR4');
    }

    function recoverSigner(Payload calldata _payload) internal view returns (address) {
        bytes32 digest = _hash(_payload);
        return ECDSA.recover(digest, _payload.signature);
    }

    function _hash(Payload calldata _payload) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256('Payload(address sender,string topic,uint256 nounce)'),
                        _payload.sender,
                        keccak256(bytes(_payload.topic)),
                        _payload.nounce
                    )
                )
            );
    }
}
