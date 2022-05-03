const inquirer = require('inquirer');
const { upgrades, ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const { nullCheck } = require('../deployments/deployHelper');

const inquirerParams = {
  contractName: 'contractName',
  contractAddress: 'contractAddress',
};

console.log(path.resolve(__dirname, '../../contracts/V1'));

const getSolidityFileList = fs
  .readdirSync(path.resolve(__dirname, '../../contracts/V1'))
  .map((filename) => filename.substr(0, filename.indexOf('.')));

const questions = [
  {
    name: inquirerParams.contractName,
    type: 'list',
    message: '🤔 Choose contract you want to import is ...',
    choices: getSolidityFileList,
  },
  {
    name: inquirerParams.contractAddress,
    type: 'input',
    message: '🤔 Proxy contract address is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    console.log('ans.contractName', ans.contractName);
    try {
      const Contract = await ethers.getContractFactory(ans.contractName);
      await upgrades.forceImport(ans.contractAddress, Contract);
      console.log('💋 Import is done!');
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
