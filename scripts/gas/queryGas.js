const inquirer = require('inquirer');

const { ethers } = require('hardhat');
const { nullCheck, numberCheck, getChainName } = require('../deployments/deployHelper');
const { queryGasToPolygon } = require('./queryGasToPolygon');
const { queryGasFeeToEthers } = require('./queryGasUsingEthersjs');

const queryGasFeeData = async () => {
  let feeData;
  const chainName = await getChainName();
  // matic 은 프로바이더에서 EIP-1559 에 맞게 정확히 데이터를 내려주지 않는다. 그래서, 폴리곤에서 제공하는 API 를 따로 사용
  if (chainName === 'matic') {
    feeData = await queryGasToPolygon();
  } else {
    feeData = await queryGasFeeToEthers();
  }
  return feeData;
};

const notNullAndNumber = (val) => {
  let result;
  const isNotNull = nullCheck(val);
  const isNumber = numberCheck(val);
  if (isNotNull === true && isNumber === true) {
    result = true;
  }
  if (isNotNull !== true) {
    result = isNotNull;
  }
  if (isNumber !== true) {
    result = isNumber;
  }
  return result;
};

// eslint-disable-next-line consistent-return
const queryGasDataAndProceed = async () => {
  let proceed;

  do {
    // eslint-disable-next-line no-await-in-loop
    const gasFeeData = await queryGasFeeData();
    const {
      raw: { maxFeePerGas, maxPriorityFeePerGas },
    } = gasFeeData;

    console.log('⛽️ Real-time Gas Fee');
    console.dir(gasFeeData, { depth: 10 });

    // eslint-disable-next-line no-await-in-loop
    const ans = await inquirer.prompt([
      {
        name: 'proceed',
        type: 'list',
        choices: ['ProceedWithCurrentFee', 'UserInput', 'Refresh', 'Abort'],
        message: '🤔 Proceed with current gas fee? or input user-defined gas fee ?',
        validate: nullCheck,
      },
    ]);
    proceed = ans.proceed;
    if (proceed === 'ProceedWithCurrentFee') {
      return { maxFeePerGas, maxPriorityFeePerGas, proceed: true };
    }
    if (proceed === 'UserInput') {
      // eslint-disable-next-line no-await-in-loop
      const userInputGasFee = await inquirer.prompt([
        {
          name: 'maxFeePerGas',
          type: 'input',
          message: '🤑 Max fee per gas ? (in ETH)',
          validate: notNullAndNumber,
        },
        {
          name: 'maxPriorityFeePerGas',
          type: 'input',
          message: '🤑 Max priority fee per gas ? (in ETH)',
          validate: notNullAndNumber,
        },
      ]);
      return {
        maxFeePerGas: ethers.utils.parseUnits(userInputGasFee.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits(userInputGasFee.maxPriorityFeePerGas, 'gwei'),
        proceed: true,
      };
    }
    if (proceed === 'Abort') {
      return { maxFeePerGas: null, maxPriorityFeePerGas: null, proceed: false };
    }
  } while (proceed === 'Refresh');
};

module.exports = { queryGasDataAndProceed, queryGasFeeData };
