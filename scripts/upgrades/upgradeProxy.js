const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { nullCheck, getRPCProvider } = require('../deployments/deployHelper');
const DEP_CONSTANTS = require('../deployments/deployConstants');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  proxy_address: 'proxy_address',
  contract_name: 'contract_name',
};

const getSolidityFileList = fs
  .readdirSync(path.resolve(__dirname, '../../contracts/V1'))
  .map((filename) => filename.substr(0, filename.indexOf('.')));

const questions = [
  {
    name: inquirerParams.deployer_private_key,
    type: 'input',
    message: '🤔 Deployer Private Key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.contract_name,
    type: 'list',
    message: '🤔 Choose contract you want to upgrade is ...',
    choices: getSolidityFileList,
  },
  {
    name: inquirerParams.proxy_address,
    type: 'input',
    message: '🤔 Previous contract proxy Address is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const deployerSigner = new ethers.Wallet(ans.deployer_private_key, provider);

      const ContractFactory = (await ethers.getContractFactory(ans.contract_name)).connect(deployerSigner);

      const upgraded = await upgrades.upgradeProxy(ans.proxy_address, ContractFactory);
      const txResponse = await upgraded.deployTransaction.wait();

      console.log(txResponse);
      console.log(chalk.yellow(`${ans.contract_name} upgrade is done`));
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
