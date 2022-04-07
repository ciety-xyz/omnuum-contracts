// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@chainlink/contracts/src/v0.8/VRFConsumerBase.sol';
import '../utils/Ownable.sol';
import './OmnuumCAManager.sol';
import './OmnuumExchange.sol';
import '../library/RevertMessage.sol';

/// @title OmnuumVRFManager - Manage VRF logic for omnuum
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Use only purpose for Omnuum
contract OmnuumVRFManager is Ownable, VRFConsumerBase {
    address private s_LINK;
    uint256 private fee;
    bytes32 private s_key_hash;
    address private omA;

    OmnuumCAManager private caManager;

    /// @notice safety margin ratio of LINK/ETH exchange rate to prevent risk of price volatility
    /// @dev 2 decimals (150 == 1.5)
    uint16 public safetyRatio = 150;

    constructor(
        address _LINK,
        address _vrf_coord,
        bytes32 _key_hash,
        uint256 _fee,
        address _omnuumCA
    ) VRFConsumerBase(_vrf_coord, _LINK) {
        /// @custom:error (AE1) - Zero address not acceptable
        require(_LINK != address(0), 'AE1');
        require(_vrf_coord != address(0), 'AE1');
        require(_omnuumCA != address(0), 'AE1');

        s_LINK = _LINK;
        s_key_hash = _key_hash;
        fee = _fee;
        caManager = OmnuumCAManager(_omnuumCA);
    }

    /// @notice request address to request ID
    mapping(address => bytes32) public aToId;

    /// @notice request ID to request address
    mapping(bytes32 => address) public idToA;

    /// @notice request ID to topic
    mapping(bytes32 => string) public idToTopic;

    /// @dev actionType: fee, safetyRatio
    event Updated(uint256 value, string actionType);
    event RequestVRF(address indexed roller, bytes32 indexed requestId, string topic);
    event ResponseVRF(bytes32 indexed requestId, uint256 randomness, string topic, bool success, string reason);

    /// @notice request vrf call
    /// @dev only allowed contract which has VRF role
    /// @param _topic contract which will use this vrf result
    function requestVRF(string calldata _topic) external payable {
        address exchangeAddress = caManager.getContract('EXCHANGE');

        // @custom:error (OO7) - Only role owner can access
        require(caManager.hasRole(msg.sender, 'VRF'), 'OO7');

        // @custom:error (SE7) - Not enough LINK at exchange contract
        require(LINK.balanceOf(exchangeAddress) >= fee, 'SE7');

        /// @custom:dev receive link from exchange, send all balance because there isn't any withdraw feature
        OmnuumExchange(exchangeAddress).exchangeToken{ value: address(this).balance }(s_LINK, fee, address(this));

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = msg.sender;
        idToTopic[requestId] = _topic;

        emit RequestVRF(msg.sender, requestId, _topic);
    }

    /// @notice request vrf call
    /// @dev only allowed contract which has VRF role
    /// @dev Can use this function only once per target address
    /// @param _targetAddress contract which will use this vrf result
    /// @param _topic contract which will use this vrf result
    function requestVRFOnce(address _targetAddress, string calldata _topic) external payable {
        /// @custom:error (SE8) - Already used address
        require(aToId[_targetAddress] == '', 'SE8');

        address exchangeAddress = caManager.getContract('EXCHANGE');

        // @custom:error (OO7) - Only role owner can access
        require(caManager.hasRole(msg.sender, 'VRF'), 'OO7');

        /// @custom:error (SE7) - Not enough LINK at exchange contract
        require(LINK.balanceOf(exchangeAddress) >= fee, 'SE7');

        uint256 required_amount = OmnuumExchange(exchangeAddress).getExchangeAmount(address(0), s_LINK, fee);

        /// @custom:error (ARG3) - Not enough ether sent
        require(msg.value >= (required_amount * safetyRatio) / 100, 'ARG3');

        /// @custom:dev receive link from exchange, send all balance because there isn't any withdraw feature
        OmnuumExchange(exchangeAddress).exchangeToken{ value: address(this).balance }(s_LINK, fee, address(this));

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = _targetAddress;
        idToTopic[requestId] = _topic;

        emit RequestVRF(_targetAddress, requestId, _topic);
    }

    /// @notice hook function which called when vrf response received
    /// @param _requestId used to find request history and emit event for matching info
    /// @param _randomness result number of VRF
    function fulfillRandomness(bytes32 _requestId, uint256 _randomness) internal override {
        address requestAddress = idToA[_requestId];
        /// @custom:dev Not required to implement, but if developer wants to do specific action at response time, he/she should implement vrfResponse method at target contract
        bytes memory payload = abi.encodeWithSignature('vrfResponse(uint256)', _randomness);
        (bool success, bytes memory returnData) = address(requestAddress).call(payload);

        string memory reason = success ? '' : RevertMessage.parse(returnData);

        aToId[requestAddress] = _requestId;
        delete idToA[_requestId];

        emit ResponseVRF(_requestId, _randomness, idToTopic[_requestId], success, reason);
    }

    /// @notice update ChainLink VRF fee
    /// @param _fee fee of ChainLink VRF
    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
        emit Updated(_fee, 'vrfFee');
    }

    /// @notice update safety ratio
    /// @param _safetyRatio  safety margin ratio of LINK/ETH exchange rate to prevent risk of price volatility
    function updateSafetyRatio(uint16 _safetyRatio) external onlyOwner {
        /// @custom:error (NE6) - Margin rate should above or equal 100
        require(_safetyRatio >= 100, 'NE6');
        safetyRatio = _safetyRatio;
        emit Updated(_safetyRatio, 'safetyRatio');
    }
}
