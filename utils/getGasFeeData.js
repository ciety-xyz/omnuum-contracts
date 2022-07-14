const { ethers } = require('hardhat');
const { go, entries, map, object } = require('fxjs');
const { getRPCProvider } = require('../scripts/deployments/deployHelper');

(async () => {
  const provider = await getRPCProvider();

  const feeData = await provider.getFeeData();

  const bnToGWei = (bigNumber) => ethers.utils.formatUnits(bigNumber, 'gwei');

  const fees = go(
    entries(feeData),
    map(([k, fee]) => [k, bnToGWei(fee)]),
    object,
  );

  console.dir(fees, { depth: 5 });
})();
