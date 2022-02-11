// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@chainlink/contracts/src/v0.8/VRFConsumerBase.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/ISenderVerifier.sol';
import './OmnuumCAManager.sol';
import './OmnuumExchange.sol';

contract OmnuumVRFManager is Ownable, VRFConsumerBase {
    //RINKBY CHAINLINK
    address s_LINK;
    uint256 fee;
    bytes32 s_key_hash;
    address omA;

    OmnuumCAManager omnuumCA;
    OmnuumExchange exchange;

    uint16 safetyRatio = 150;

    constructor(
        address _LINK,
        address _vrf_coord,
        bytes32 _key_hash,
        uint256 _fee,
        address _omnuumCA
    ) VRFConsumerBase(_vrf_coord, _LINK) {
        s_LINK = _LINK;
        s_key_hash = _key_hash;
        fee = _fee;
        omnuumCA = OmnuumCAManager(_omnuumCA);
        exchange = OmnuumExchange(omnuumCA.getContract('EXCHANGE'));
    }

    mapping(address => bytes32) aToId;
    mapping(bytes32 => address) idToA;

    // actionType: fee, safetyRatio
    event Updated(uint256 value, string actionType);
    event RequestVRF(address indexed roller, bytes32 indexed requestId);
    event ResponseVRF(bytes32 indexed requestId, uint256 randomness);

    // Only for allowed CA (Omnuum contracts except NFT contract)
    function requestVRF() external {
        require(LINK.balanceOf(address(0)) > 2 ether, 'Not enough LINK');
        require(omnuumCA.isRegistered(msg.sender), 'Not allowed address');

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = msg.sender;

        emit RequestVRF(msg.sender, requestId);
    }

    function requestVRFOnce() external payable {
        require(msg.sender == omnuumCA.getContract('REVEAL'), 'OO3');

        require(LINK.balanceOf(address(0)) > 2 ether, 'Not enough LINK');

        uint256 required_amount = exchange.getExchangeRate(address(0), s_LINK, fee);
        require((required_amount * safetyRatio) / 100 <= msg.value, 'Ether is not enough for LINK');

        // receive 2 link from exchange
        exchange.exchangeToken(s_LINK, 2 ether, address(this));

        require(aToId[msg.sender] == '', 'Already used');

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = msg.sender;

        emit RequestVRF(msg.sender, requestId);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        bytes memory payload = abi.encodeWithSignature('vrfResponse(uint256)', randomness);
        (bool success, ) = address(idToA[requestId]).call(payload);
        require(success, 'fail!');

        aToId[idToA[requestId]] = requestId;
        delete idToA[requestId];

        emit ResponseVRF(requestId, randomness);
    }

    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
        emit Updated(_fee, 'fee');
    }

    function updateSafetyRatio(uint16 _safetyRatio) external onlyOwner {
        safetyRatio = _safetyRatio;
        emit Updated(_safetyRatio, 'safetyRatio');
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}
