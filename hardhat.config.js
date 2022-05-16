require('dotenv').config();

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-solhint');

require('hardhat-gas-reporter');

require('@openzeppelin/hardhat-upgrades');
// require('hardhat-contract-sizer');

require('hardhat-abi-exporter');
require('solidity-coverage');

module.exports = {
  solidity: '0.8.10',
  defaultNetwork: 'localhost',
  networks: {
    hardhat: {
      accounts: {
        count: 20,
      },
      mining: {
        auto: true,
        interval: process.env.MINING_INTERVAL !== undefined ? Number(process.env.MINING_INTERVAL) : 0,
      },
    },
    mainnet: {
      url: process.env.MAINNET_URL || '',
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts: [
        process.env.OMNUUM_DEPLOYER_PRIVATE_KEY,
        process.env.ACCOUNT_TESTER_A,
        process.env.ACCOUNT_TESTER_B,
        process.env.ACCOUNT_TESTER_C,
        process.env.ACCOUNT_TESTER_D,
        process.env.ACCOUNT_TESTER_E,
      ].filter((a) => a),
      // gasPrice: 50 * 10 ** 9,
      gasPrice: 'auto',
      gasLimit: 10_000_000,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || '',
      accounts: [
        process.env.OMNUUM_DEPLOYER_PRIVATE_KEY,
        process.env.ACCOUNT_TESTER_A,
        process.env.ACCOUNT_TESTER_B,
        process.env.ACCOUNT_TESTER_C,
        process.env.ACCOUNT_TESTER_D,
        process.env.ACCOUNT_TESTER_E,
      ].filter((a) => a),
    },
  },
  optimizer: {
    enabled: true,
  },
  paths: {
    sources: './contracts',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ?? false,
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
  abiExporter: [
    {
      path: './data/abi',
      runOnCompile: true,
      clear: true,
      flat: true,
      pretty: false,
      except: ['./mock'],
    },
    {
      path: './data/abi/pretty',
      runOnCompile: true,
      clear: true,
      flat: true,
      pretty: true,
      except: ['./mock'],
    },
  ],
};

/* localhost hardhat accounts
Account #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc (10000 ETH)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

Account #3: 0x90f79bf6eb2c4f870365e785982e1f101e93b906 (10000 ETH)
Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6

Account #4: 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 (10000 ETH)
Private Key: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a

Account #5: 0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc (10000 ETH)
Private Key: 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
 * */
