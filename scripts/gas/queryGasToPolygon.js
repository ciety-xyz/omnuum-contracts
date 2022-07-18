const axios = require('axios');

const { ethers } = require('hardhat');

const truncGweiDecimals = (val) => {
  const allowedGweiDecimals = 9;
  return Math.round(Number(val) * 10 ** allowedGweiDecimals) / 10 ** allowedGweiDecimals;
};

const queryGasToPolygon = async () =>
  new Promise((res, rej) => {
    axios
      .get('https://gasstation-mainnet.matic.network/v2')
      .then((response) => {
        let {
          fast: { maxPriorityFee, maxFee },
        } = response.data;

        maxPriorityFee = truncGweiDecimals(maxPriorityFee);
        maxFee = truncGweiDecimals(maxFee);

        const feeData = {
          maxFeePerGas: `${maxFee}`,
          maxPriorityFeePerGas: `${maxPriorityFee}`,
          raw: {
            maxFeePerGas: ethers.utils.parseUnits(`${maxFee}`, 'gwei'),
            maxPriorityFeePerGas: ethers.utils.parseUnits(`${maxPriorityFee}`, 'gwei'),
          },
        };
        res(feeData);
      })
      .catch((e) => rej(e.response.data.error));
  });

module.exports = { queryGasToPolygon };
