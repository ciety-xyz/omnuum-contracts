const { ethers } = require('hardhat');
const { go, entries, map, object } = require('fxjs');
const { getRPCProvider } = require('../deployments/deployHelper');

const queryGasFeeToEthers = async () => {
  const provider = await getRPCProvider();

  const feeData = await provider.getFeeData();

  const bnToGWei = (bigNumber) => ethers.utils.formatUnits(bigNumber, 'gwei');

  const fees = {
    ...go(
      entries(feeData),
      map(([k, fee]) => [k, bnToGWei(fee)]),
      object,
    ),
    raw: feeData,
  };

  return fees;
};

module.exports = { queryGasFeeToEthers };
