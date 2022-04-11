const { createWalletOwnerAccounts } = require('../deployments/deployHelper');
const DEP_CONSTANTS = require('../deployments/deployConstants');

const walletOwnerAccounts = createWalletOwnerAccounts(DEP_CONSTANTS.wallet.ownerAddresses, DEP_CONSTANTS.wallet.ownerLevels);

console.log(walletOwnerAccounts);

module.exports = [DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, walletOwnerAccounts];
