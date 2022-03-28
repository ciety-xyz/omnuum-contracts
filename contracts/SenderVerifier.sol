// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';

/// @title SenderVerifier - verifier contract that payload is signed by omnuum or not
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
contract SenderVerifier is EIP712 {
    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    string private constant SIGNING_DOMAIN = 'Omnuum';
    string private constant SIGNATURE_VERSION = '1';

    struct Payload {
        address sender; // sender or address who received this payload
        string topic; // topic of payload
        uint256 nounce; // separate same topic payload for multiple steps or checks
        bytes signature; // signature of this payload
    }

    /// @notice verify function
    /// @param _owner address who is believed to be signer of payload signature
    /// @param _sender address who is believed to be target of payload signature
    /// @param _topic topic of payload
    /// @param _nounce nonce of payload
    /// @param _payload payload struct
    function verify(
        address _owner,
        address _sender,
        string calldata _topic,
        uint256 _nounce,
        Payload calldata _payload
    ) external view {
        address signer = recoverSigner(_payload);
        require(_owner == signer, 'False Signer');
        require(_nounce == _payload.nounce, 'False Nounce');
        require(keccak256(abi.encodePacked(_payload.topic)) == keccak256(abi.encodePacked(_topic)), 'False Topic');
        require(_payload.sender == _sender, 'False Sender');
    }

    /// @dev recover signer from payload hash
    /// @param _payload payload struct
    function recoverSigner(Payload calldata _payload) internal view returns (address) {
        bytes32 digest = _hash(_payload);
        return ECDSA.recover(digest, _payload.signature);
    }

    /// @dev hash payload
    /// @param _payload payload struct
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
