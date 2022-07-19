const rimraf = require('rimraf');

const inquirer = require('inquirer');
const chalk = require('chalk');

const path = require('path');
const main = require('./index');

const { nullCheck } = require('./deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  signatureSignerAddress: 'signatureSignerAddress',
  maxPriorityFeePerGas: 'maxPriorityFeePerGas',
  maxFeePerGas: 'maxFeePerGas',
  eip1559: 'eip1559',
  save: 'save',
  withCompile: 'withCompile',
  cleanHistory: 'cleanHistory',
};

const questions = [
  {
    name: inquirerParams.devDeployerPrivateKey,
    type: 'input',
    message: '🤔 Deployer [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.signatureSignerAddress,
    type: 'input',
    message: '🤔 Signer [ ADDRESS ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.save,
    type: 'list',
    choices: ['OnlyLocal', 'OnlyS3', 'Both', 'Nowhere'],
    message: chalk.yellow(`🤔 Save Result JSON file to ${chalk.redBright('WHERE... ?')}`),
  },
  {
    name: inquirerParams.withCompile,
    type: 'confirm',
    message: chalk.yellow('🤔 Re-compile solidity files... ?'),
  },
  {
    name: inquirerParams.cleanHistory,
    type: 'confirm',
    message: chalk.yellow('🤔 Clean deployment history... ?'),
  },
];

(async () => {
  try {
    inquirer.prompt(questions).then(async (ans) => {
      let maxFeePerGasLimit;
      const { gasModeAuto } = await inquirer.prompt({
        name: 'gasModeAuto',
        type: 'confirm',
        message: chalk.yellow('🤔 Gas Strategy runs in Auto Mode... ?'),
      });

      if (gasModeAuto) {
        const limit = await inquirer.prompt({
          name: 'maxFeePerGasLimit',
          type: 'input',
          message: chalk.yellow('🤔 Input MaxFeePerGas Limit (gwei)... ? (when over limit, gas strategy switch to Auto => Manual)  '),
        });
        maxFeePerGasLimit = limit.maxFeePerGasLimit;
      }
      if (ans.cleanHistory) {
        // Remove deployment temp history file
        rimraf.sync(path.resolve(__dirname, 'deployResults', 'tmp_history.json'));
      }

      await main({
        deployerPK: ans.devDeployerPrivateKey,
        signerAddress: ans.signatureSignerAddress,
        gasModeAuto,
        maxFeePerGasLimit,
        localSave: ans.save === 'OnlyLocal' || ans.save === 'Both',
        s3Save: ans.save === 'OnlyS3' || ans.save === 'Both',
        withCompile: ans.withCompile,
      });
    });
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
  }
})();
