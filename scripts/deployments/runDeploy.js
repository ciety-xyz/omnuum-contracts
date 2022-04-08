const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
};

const questions = [
  {
    name: inquirerParams.dev_deployer_private_key,
    type: 'input',
    message: '🤔 Dev deployer private key is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      await main(ans.dev_deployer_private_key);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
