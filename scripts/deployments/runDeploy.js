const inquirer = require('inquirer');
const chalk = require('chalk');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  signatureSignerAddress: 'signatureSignerAddress',
  maxPriorityFeePerGas: 'maxPriorityFeePerGas',
  maxFeePerGas: 'maxFeePerGas',
  eip1559: 'eip1559',
  localSave: 'localSave',
  s3Save: 's3Save',
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
    name: inquirerParams.localSave,
    type: 'confirm',
    message: chalk.yellow(`🤔 Save result JSON file to ${chalk.redBright('local')}`),
  },
  {
    name: inquirerParams.s3Save,
    type: 'confirm',
    message: chalk.yellow(`🤔 Save result JSON file to ${chalk.redBright('S3')}`),
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
        await main({
          deployerPK: ans.devDeployerPrivateKey,
          signerAddress: ans.signatureSignerAddress,
          localSave: ans.localSave,
          s3Save: ans.s3Save,
        });
      } else {
        inquirer.prompt(gasQuestions).then(async (gasAns) => {
          await main({
            deployerPK: ans.devDeployerPrivateKey,
            signerAddress: ans.signatureSignerAddress,
            gasPrices: {
              maxFeePerGas: gasAns.maxFeePerGas,
              maxPriorityFeePerGas: gasAns.maxPriorityFeePerGas,
            },
            localSave: ans.localSave,
            s3Save: ans.s3Save,
          });
        });
      }
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
