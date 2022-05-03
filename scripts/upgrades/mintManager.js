const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../deployments/deployHelper');
const DEP_CONSTANTS = require('../deployments/deployConstants');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  proxy_address: 'proxy_address',
  ca_manager_address: 'ca_manager_address',
};

const questions = [
  {
    name: inquirerParams.deployer_private_key,
    type: 'input',
    message: '🤔 Deployer Private Key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.proxy_address,
    type: 'input',
    message: '🤔 Proxy Address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ca_manager_address,
    type: 'input',
    message: '🤔 CA Manager Address is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const deployerSigner = new ethers.Wallet(ans.deployer_private_key, provider);

      const MintManager = (await ethers.getContractFactory('OmnuumMintManager')).connect(deployerSigner);
      const MintManager2 = (await ethers.getContractFactory('OmnuumMintManager2')).connect(deployerSigner);
      const proxy = await upgrades.forceImport(ans.proxy_address, MintManager, {
        kind: 'transparent',
      });

      console.log('proxy', proxy);
      const upgraded = await upgrades.upgradeProxy(
        proxy,
        MintManager2,
        // call: { fn: 'initialize(uint256,address)', args: [DEP_CONSTANTS.mintManager.feeRate, ans.ca_manager_address] },
      );

      console.log(upgraded);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
