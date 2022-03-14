require('dotenv').config();

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');

require('hardhat-gas-reporter');
require('solidity-coverage');

require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');
require('hardhat-abi-exporter');

module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'localhost',
  networks: {
    hardhat: {
      accounts: {
        count: 100,
      },
      mining: {
        auto: true,
        interval: process.env.MINING_INTERVAL !== undefined ? Number(process.env.MINING_INTERVAL) : 0,
      },
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts: [
        process.env.ACCOUNT_DEV_DEPLOYER,
        process.env.ACCOUNT_TESTER_A,
        process.env.ACCOUNT_TESTER_B,
        process.env.ACCOUNT_TESTER_C,
        process.env.ACCOUNT_TESTER_D,
        process.env.ACCOUNT_TESTER_E,
      ],
      gasPrice: 30 * 10 ** 9,
      gasLimit: 30000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_KEY,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  abiExporter: {
    path: './data/abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    pretty: true,
  },
};
