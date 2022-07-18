const { getRPCProvider, queryGasFeeData } = require('../scripts/deployments/deployHelper');

(async () => {
  const gasFee = await queryGasFeeData(await getRPCProvider());
  console.dir(gasFee, { depth: 10 });
})();
