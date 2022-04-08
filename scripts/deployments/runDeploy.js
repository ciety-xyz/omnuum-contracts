const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  signatureSignerAddress: 'signatureSignerAddress',
};

const questions = [
  {
    name: inquirerParams.devDeployerPrivateKey,
    type: 'input',
    message: '🤔 Dev deployer private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.signatureSignerAddress,
    type: 'input',
    message: '🤔 Sinature signer address is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      await main(ans.devDeployerPrivateKey, ans.signatureSignerAddress);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
