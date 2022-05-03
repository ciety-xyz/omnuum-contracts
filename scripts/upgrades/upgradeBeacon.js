const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { getRPCProvider, nullCheck } = require('../deployments/deployHelper');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  beacon_address: 'beacon_address',
};

const questions = [
  {
    name: inquirerParams.deployer_private_key,
    type: 'input',
    message: '🤔 Deployer private key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.beacon_address,
    type: 'input',
    message: '🤔 Beacon address is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const deployerSigner = new ethers.Wallet(ans.deployer_private_key, provider);

      const ContractFactory = (await ethers.getContractFactory('OmnuumNFT1155')).connect(deployerSigner);

      const upgraded = await upgrades.upgradeBeacon(ans.beacon_address, ContractFactory);

      const txResponse = await upgraded.deployTransaction.wait();

      console.log(txResponse);
      console.log(chalk.yellow('OmnuumNFT1155 beacon upgrade is done'));
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
