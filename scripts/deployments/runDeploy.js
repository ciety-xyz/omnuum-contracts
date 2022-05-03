const inquirer = require('inquirer');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  signatureSignerAddress: 'signatureSignerAddress',
  maxPriorityFeePerGas: 'maxPriorityFeePerGas',
  maxFeePerGas: 'maxFeePerGas',
  eip1559: 'eip1559',
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
    name: inquirerParams.eip1559,
    type: 'list',
    message: '🤔 You wanna gas fee customizable?',
    choices: ['normal', 'eip1559'],
  },
];

const gasQuestions = [
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
      if (ans.eip1559 === 'normal') {
        await main(ans.devDeployerPrivateKey, ans.signatureSignerAddress);
      } else {
        inquirer.prompt(gasQuestions).then(async (gasAns) => {
          await main(ans.devDeployerPrivateKey, ans.signatureSignerAddress, {
            maxFeePerGas: gasAns.maxFeePerGas,
            maxPriorityFeePerGas: gasAns.maxPriorityFeePerGas,
          });
        });
      }
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
