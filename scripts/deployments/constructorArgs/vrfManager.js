const { chainlink } = require('../../../utils/constants');

console.log([...Object.values(chainlink.rinkeby)]);

module.exports = [...Object.values(chainlink.rinkeby), '0x3a1d375b17c10cc6e2b52fa6758fa1b1ca99d39e']; // baseFeeRate
