// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@chainlink/contracts/src/v0.8/VRFConsumerBase.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './OmnuumCAManager.sol';
import './OmnuumExchange.sol';
import './library/RevertMessage.sol';

contract OmnuumVRFManager is Ownable, VRFConsumerBase {
    //RINKBY CHAINLINK
    address s_LINK;
    uint256 fee;
    bytes32 s_key_hash;
    address omA;

    OmnuumCAManager caManager;

    uint16 public safetyRatio = 150;

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
        caManager = OmnuumCAManager(_omnuumCA);
    }

    mapping(address => bytes32) aToId;
    mapping(bytes32 => address) idToA;

    // actionType: fee, safetyRatio
    event Updated(uint256 value, string actionType);
    event RequestVRF(address indexed roller, bytes32 indexed requestId);
    event ResponseVRF(bytes32 indexed requestId, uint256 randomness, bool success, string reason);

    // Only for allowed CA (Omnuum contracts except NFT contract)
    function requestVRF() external {
        address exchangeAddress = caManager.getContract('EXCHANGE');
        require(LINK.balanceOf(exchangeAddress) > 2 ether, 'Not enough LINK');
        require(caManager.isRegistered(msg.sender), 'OO3');

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = msg.sender;

        emit RequestVRF(msg.sender, requestId);
    }

    function requestVRFOnce(address targetAddress) external payable {
        require(caManager.isRegistered(msg.sender), 'OO3');

        address exchangeAddress = caManager.getContract('EXCHANGE');

        require(LINK.balanceOf(exchangeAddress) >= 2 ether, 'Not enough LINK');

        uint256 required_amount = OmnuumExchange(exchangeAddress).getExchangeAmount(address(0), s_LINK, fee);
        require((required_amount * safetyRatio) / 100 <= msg.value, 'Not enough Ether');

        require(aToId[targetAddress] == '', 'Already used');

        // receive 2 link from exchange
        OmnuumExchange(exchangeAddress).exchangeToken{ value: msg.value }(s_LINK, 2 ether, address(this));

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = targetAddress;

        emit RequestVRF(targetAddress, requestId);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        address requestAddress = idToA[requestId];
        // contracts should implement vrfResponse method if they want to do specific action
        bytes memory payload = abi.encodeWithSignature('vrfResponse(uint256)', randomness);
        (bool success, bytes memory returnData) = address(requestAddress).call(payload);

        string memory reason = success ? '' : RevertMessage.parse(returnData);

        aToId[requestAddress] = requestId;
        delete idToA[requestId];

        emit ResponseVRF(requestId, randomness, success, reason);
    }

    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
        emit Updated(_fee, 'fee');
    }

    function updateSafetyRatio(uint16 _safetyRatio) external onlyOwner {
        safetyRatio = _safetyRatio;
        emit Updated(_safetyRatio, 'safetyRatio');
    }
}
