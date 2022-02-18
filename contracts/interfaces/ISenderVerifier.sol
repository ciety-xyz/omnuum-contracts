// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

interface ISenderVerifier {
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
    ) external view;
}
