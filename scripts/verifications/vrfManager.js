// address _LINK,
//   address _vrf_coord,
//   bytes32 _key_hash,
//   uint256 _fee,
//   address _omnuumCA (CA manager)

const DEP_CONSTANTS = require('../deployments/deployConstants');

module.exports = [...Object.values(DEP_CONSTANTS.vrfManager.chainlink.mainnet), '0xD52F874978c3B86Ef4A8DC5e03AdaA4F3C81B8Ab'];
