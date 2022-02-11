// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol';
import './ISenderVerifier.sol';

interface IOmnuumNFT1155 is IERC165Upgradeable {
    struct MintTicket {
        uint16 receivedCount;
        uint16 usedCount;
    }

    event UriChanged(string uri, string actionType);
    event Public(bool isPublic, uint256 basePrice);

    function initialize() external;

    function changePublicMint(bool _isPublic, uint256 _basePrice) external;

    function mint(
        address _to,
        uint16 _quantity,
        uint256 _price,
        ISenderVerifier.Payload calldata payload
    ) external payable;

    function mintDirect(address _to, uint16 _quantity) external;

    function endMint() external;

    function setUri(string memory __uri) external;

    function setCoverUri(string memory _coverUri) external;

    function uri(uint256) external view returns (string memory);

    function withdraw() external;
}
