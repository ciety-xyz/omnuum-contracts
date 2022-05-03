const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../deployments/deployHelper');
const DEP_CONSTANTS = require('../deployments/deployConstants');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  proxy_address: 'proxy_address',
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
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const deployerSigner = new ethers.Wallet(ans.deployer_private_key, provider);

      const MintManager = (await ethers.getContractFactory('OmnuumMintManager')).connect(deployerSigner);

      const upgraded = await upgrades.upgradeProxy(ans.proxy_address, MintManager);
      const txResponse = await upgraded.deployTransaction.wait();

      console.log(txResponse);
      console.log('Upgrade is done');
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
