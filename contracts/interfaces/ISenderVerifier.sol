// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

interface ISenderVerifier {
    struct Payload {
        address sender;
        string topic;
        uint32 nounce;
        bytes signature;
    }

    function verify(
        address _owner,
        address _sender,
        string calldata _topic,
        uint32 _nounce,
        Payload calldata _payload
    ) external view;
}
