const inquirer = require('inquirer');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  signatureSignerAddress: 'signatureSignerAddress',
  maxPriorityFeePerGas: 'maxPriorityFeePerGas',
  maxFeePerGas: 'maxFeePerGas',
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
    message: '🤔 Signature signer address is (not private key, just address)...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.maxFeePerGas,
    type: 'input',
    message: '🤔 maxFeePerGas is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.maxPriorityFeePerGas,
    type: 'input',
    message: '🤔 maxPriorityFeePerGas is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      await main(ans.devDeployerPrivateKey, ans.signatureSignerAddress, {
        maxFeePerGas: ans.maxFeePerGas,
        maxPriorityFeePerGas: ans.maxPriorityFeePerGas,
      });
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
