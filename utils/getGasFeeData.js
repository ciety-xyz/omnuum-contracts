const { queryGasFeeData } = require('../scripts/gas/queryGas');

(async () => {
  const gasFee = await queryGasFeeData();
  console.dir(gasFee, { depth: 10 });
})();
