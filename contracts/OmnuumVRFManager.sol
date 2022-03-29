// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import '@chainlink/contracts/src/v0.8/VRFConsumerBase.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './OmnuumCAManager.sol';
import './OmnuumExchange.sol';
import './library/RevertMessage.sol';

/// @title OmnuumVRFManager - Manage VRF logic for omnuum
/// @author Omnuum Dev Team - <crypto_dev@omnuum.com>
/// @notice Use only purpose for Omnuum
contract OmnuumVRFManager is Ownable, VRFConsumerBase {
    address s_LINK;
    uint256 fee;
    bytes32 s_key_hash;
    address omA;

    OmnuumCAManager caManager;

    /// @notice safety margin ratio of LINK/ETH exchange rate to prevent risk of price volatility
    /// @dev 2 decimal (150 == 1.5)
    uint16 public safetyRatio = 150;

    constructor(
        address _LINK,
        address _vrf_coord,
        bytes32 _key_hash,
        uint256 _fee,
        address _omnuumCA
    ) VRFConsumerBase(_vrf_coord, _LINK) {
        require(_LINK != address(0));
        require(_vrf_coord != address(0));
        require(_omnuumCA != address(0));

        s_LINK = _LINK;
        s_key_hash = _key_hash;
        fee = _fee;
        caManager = OmnuumCAManager(_omnuumCA);
    }

    /// @dev request address to request ID
    mapping(address => bytes32) aToId;

    /// @dev request ID to request address
    mapping(bytes32 => address) idToA;

    /// @dev actionType: fee, safetyRatio
    event Updated(uint256 value, string actionType);
    event RequestVRF(address indexed roller, bytes32 indexed requestId);
    event ResponseVRF(bytes32 indexed requestId, uint256 randomness, bool success, string reason);

    /// @notice request vrf call
    /// @dev only allowed contract which has VRF role
    function requestVRF() external {
        address exchangeAddress = caManager.getContract('EXCHANGE');
        require(LINK.balanceOf(exchangeAddress) > 2 ether, 'Not enough LINK');
        require(caManager.hasRole(msg.sender, 'VRF'), 'OO3');

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = msg.sender;

        emit RequestVRF(msg.sender, requestId);
    }

    /// @notice request vrf call
    /// @dev only allowed contract which has VRF role
    /// @dev Can use this function only once per target address
    /// @param _targetAddress contract which will use this vrf result
    function requestVRFOnce(address _targetAddress) external payable {
        require(caManager.hasRole(msg.sender, 'VRF'), 'OO3');
        require(_targetAddress != address(0));

        address exchangeAddress = caManager.getContract('EXCHANGE');

        require(LINK.balanceOf(exchangeAddress) >= 2 ether, 'Not enough LINK');

        uint256 required_amount = OmnuumExchange(exchangeAddress).getExchangeAmount(address(0), s_LINK, fee);
        require((required_amount * safetyRatio) / 100 <= msg.value, 'Not enough Ether');

        require(aToId[_targetAddress] == '', 'Already used');

        // receive 2 link from exchange
        OmnuumExchange(exchangeAddress).exchangeToken{ value: msg.value }(s_LINK, 2 ether, address(this));

        bytes32 requestId = requestRandomness(s_key_hash, fee);
        idToA[requestId] = _targetAddress;

        emit RequestVRF(_targetAddress, requestId);
    }

    /// @notice hook function which called when vrf response received
    /// @param _requestId used to find request history and emit event for matching info
    /// @param _randomness result number of VRF
    function fulfillRandomness(bytes32 _requestId, uint256 _randomness) internal override {
        address requestAddress = idToA[_requestId];
        // contracts should implement vrfResponse method if they want to do specific action
        bytes memory payload = abi.encodeWithSignature('vrfResponse(uint256)', _randomness);
        (bool success, bytes memory returnData) = address(requestAddress).call(payload);

        string memory reason = success ? '' : RevertMessage.parse(returnData);

        aToId[requestAddress] = _requestId;
        delete idToA[_requestId];

        emit ResponseVRF(_requestId, _randomness, success, reason);
    }

    /// @notice update ChainLink VRF fee
    /// @param _fee fee of ChainLink VRF
    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
        emit Updated(_fee, 'fee');
    }

    /// @notice update safety ratio
    /// @param _safetyRatio  safety margin ratio of LINK/ETH exchange rate to prevent risk of price volatility
    function updateSafetyRatio(uint16 _safetyRatio) external onlyOwner {
        safetyRatio = _safetyRatio;
        emit Updated(_safetyRatio, 'safetyRatio');
    }
}
