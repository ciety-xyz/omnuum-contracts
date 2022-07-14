// address _LINK,
//   address _vrf_coord,
//   bytes32 _key_hash,
//   uint256 _fee,
//   address _omnuumCA (CA manager)

const DEP_CONSTANTS = require('../deployments/deployConstants');

module.exports = [...Object.values(DEP_CONSTANTS.vrfManager.chainlink.matic), '0xB1b09A19eCd692a071efe5E370653E3ef10d8129'];
