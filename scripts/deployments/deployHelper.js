const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');

const { writeFile, readFile } = require('fs/promises');
const { go, zip, map, each } = require('fxjs');

const UpgradeableBeacon = require('@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json');

const DEP_CONSTANTS = require('./deployConstants');
const { queryGasFeeToEthers, queryGasToPolygon } = require('../gas/queryGas');

const prev_history_file_path = './scripts/deployments/deployResults/tmp_history.json';

const tryCatch = async (f, catchFn) => {
  try {
    return await f();
  } catch (err) {
    return catchFn(err);
  }
};

const getChainName = async () => {
  const { chainId } = await ethers.provider.getNetwork();
  switch (chainId) {
    case 1:
      return 'mainnet';
    case 3:
      return 'ropsten';
    case 4:
      return 'rinkeby';
    case 5:
      return 'goerli';
    case 137:
      return 'matic';
    case 80001:
      return 'mumbai';
    case 31337:
      return 'localhost';
    default:
      return 'unrecognized network';
  }
};

const getRPCProvider = async () => {
  const chainName = await getChainName();

  const jsonRpcProvider =
    chainName === 'localhost'
      ? null
      : chainName === 'mainnet'
      ? process.env.MAINNET_URL
      : chainName === 'rinkeby'
      ? process.env.RINKEBY_URL
      : chainName === 'ropsten'
      ? process.env.ROPSTEN_URL
      : chainName === 'goerli'
      ? process.env.GOERLI_URL
      : chainName === 'matic'
      ? process.env.POLYGON_MAINNET_RPC_URL
      : chainName === 'mumbai'
      ? process.env.MUMBAI_RPC_URL
      : null;

  return new ethers.providers.JsonRpcProvider(jsonRpcProvider);
};

const getSingleFallbackProvider = async (provider) => new ethers.providers.FallbackProvider([provider ?? (await getRPCProvider())], 1);

// Side effect to provider overriding getFeeData function
const set1559FeeDataToProvider = (provider, maxFeePerGas, maxPriorityFeePerGas) => {
  // eslint-disable-next-line no-param-reassign
  provider.getFeeData = async () => ({ maxFeePerGas, maxPriorityFeePerGas });
};

const readDeployTmpHistory = () => go(readFile(prev_history_file_path, 'utf8'), JSON.parse);

const writeDeployTmpHistory = async (history) => {
  try {
    await writeFile(prev_history_file_path, JSON.stringify(history));
  } catch (err) {
    console.log(chalk.yellow(`\nWrite tmp deploy history failed: ${err.message}`));
  }
};

const structurizeProxyData = (deployObj) => ({
  proxy: deployObj.proxyContract.address,
  impl: deployObj.implAddress,
  admin: deployObj.adminAddress,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
  blockNumber: ethers.BigNumber.from(deployObj.blockNumber).toNumber(),
  address: deployObj.proxyContract.address,
});

const structurizeContractData = (deployObj) => ({
  contract: deployObj.contract.address,
  address: deployObj.contract.address,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
  blockNumber: ethers.BigNumber.from(deployObj.blockNumber).toNumber(),
  args: deployObj.args || [],
});

const isLocalNetwork = async (provider) => {
  const { chainId } = await provider.getNetwork();
  return ![1, 2, 3, 4, 5].includes(+chainId);
};

const nullCheck = (val) => {
  if (!(val === '')) {
    return true;
  }
  return '🚨 Null is not allowed';
};

const numberCheck = (val) => {
  if (!Number.isNaN(Number(val))) {
    return true;
  }
  return '🚨 Only number allows';
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

const queryGasFeeData = async (provider) => {
  let feeData;
  const chainName = await getChainName();
  // matic 은 프로바이더에서 EIP-1559 에 맞게 정확히 데이터를 내려주지 않는다. 그래서, 폴리곤에서 제공하는 API 를 따로 사용
  if (chainName === 'matic') {
    feeData = await queryGasToPolygon();
  } else {
    feeData = await queryGasFeeToEthers(provider);
  }
  return feeData;
};

// eslint-disable-next-line consistent-return
const queryGasDataAndProceed = async () => {
  let proceed;

  do {
    // eslint-disable-next-line no-await-in-loop
    const gasFeeData = await queryGasFeeData(await getRPCProvider());
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
          message: '🤑 Max fee per gas ? (in gwei)',
          validate: notNullAndNumber,
        },
        {
          name: 'maxPriorityFeePerGas',
          type: 'input',
          message: '🤑 Max priority fee per gas ? (in gwei)',
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

const getDateSuffix = () =>
  `${new Date().toLocaleDateString().replace(/\//g, '-')}_${new Date().toLocaleTimeString('en', { hour12: false })}`;

const deployConsoleRow = (title, data) => `  ${chalk.green(title)} ${data}\n`;

const alreadyDeployedConsole = (contractName, addr) => {
  console.log(`\n${chalk.yellow(`<${contractName}>`)} - Skip for deployed contract (${addr})`);
};

const getProxyDeployMetadata = async (proxyContract) => {
  const txResponse = await proxyContract.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait(DEP_CONSTANTS.confirmWait);
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyContract.address);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyContract.address);
  const { gasUsed, blockNumber } = deployTxReceipt;

  return {
    deployTxReceipt,
    implAddress,
    adminAddress,
    gasUsed,
    blockNumber,
  };
};

const deployBeaconConsole = (contractName, beaconAddr, ImplAddr, gasUsed, txHash, blockNumber) =>
  console.log(
    `\n${chalk.green(`<${contractName}>`)}\n${[
      deployConsoleRow('Block', blockNumber),
      deployConsoleRow('TxHash', txHash),
      deployConsoleRow('BeaconContractAddress', beaconAddr),
      deployConsoleRow('Impl', ImplAddr),
      deployConsoleRow('GasUsed', gasUsed),
    ].join('')}`,
  );

const deployProxyConsole = (contractName, proxyAddr, ImplAddr, adminAddress, gasUsed, txHash, blockNumber) =>
  console.log(
    `\n${chalk.green(`<${contractName}>`)}\n${[
      deployConsoleRow('Block', blockNumber),
      deployConsoleRow('TxHash', txHash),
      deployConsoleRow('ProxyContractAddress', proxyAddr),
      deployConsoleRow('Impl', ImplAddr),
      deployConsoleRow('Admin', adminAddress),
      deployConsoleRow('GasUsed', gasUsed),
    ].join('')}`,
  );

const deployConsole = (contractName, deployAddress, gasUsed, txHash, blockNumber) =>
  console.log(
    `\n${chalk.green(`<${contractName}>`)}\n${[
      deployConsoleRow('Block', blockNumber),
      deployConsoleRow('TxHash', txHash),
      deployConsoleRow('contractAddress', deployAddress),
      deployConsoleRow('GasUsed', gasUsed),
    ].join('')}`,
  );

const deployBeacon = async ({ contractName, deploySigner, log = true }) => {
  const contractFactory = await ethers.getContractFactory(contractName);
  const history = await readDeployTmpHistory();

  // restore deploy result
  if (history[contractName]) {
    log && alreadyDeployedConsole(contractName, history[contractName].beaconAddress);

    const beacon = (await ethers.getContractFactory(UpgradeableBeacon.abi, UpgradeableBeacon.bytecode)).attach(
      history[contractName].beaconAddress,
    );

    return {
      beacon,
      contractFactory,
      ...history[contractName],
    };
  }

  log && console.log(`\n${chalk.magentaBright('Start Deploying:')} ${contractName} - ${new Date()}`);

  const beacon = await upgrades.deployBeacon(contractFactory.connect(deploySigner));
  const txResponse = await beacon.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait(DEP_CONSTANTS.confirmWait);
  const implAddress = await upgrades.beacon.getImplementationAddress(beacon.address);
  const { gasUsed, blockNumber } = deployTxReceipt;

  log && deployBeaconConsole(contractName, beacon.address, implAddress, gasUsed, txResponse.deployTransaction.hash, blockNumber);

  await writeDeployTmpHistory({
    ...history,
    [contractName]: {
      beaconAddress: beacon.address,
      implAddress,
      gasUsed: gasUsed.toString(),
      blockNumber: blockNumber.toString(),
    },
  });

  return {
    beacon,
    implAddress,
    contractFactory,
    gasUsed,
    blockNumber,
  };
};

const deployProxy = async ({ contractName, deploySigner, args = [], log = true }) => {
  const history = await readDeployTmpHistory();
  const contractFactory = await ethers.getContractFactory(contractName);

  // restore deploy result
  if (history[contractName]) {
    log && alreadyDeployedConsole(contractName, history[contractName].proxyAddress);

    return {
      skip: true,
      proxyContract: contractFactory.attach(history[contractName].proxyAddress),
      contractFactory,
      ...history[contractName],
    };
  }

  log && console.log(`\n${chalk.magentaBright('Start Deploying:')} ${contractName} - ${new Date()}`);

  // Fallback Provider
  const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryGasDataAndProceed();
  if (!proceed) {
    throw new Error('🚨 Transaction Aborted!');
  }

  // Set EIP-1559 Fee Data to Provider ( Override tx to type:2 )
  set1559FeeDataToProvider(deploySigner.provider, maxFeePerGas, maxPriorityFeePerGas);

  const proxyContract = await upgrades.deployProxy(contractFactory.connect(deploySigner), args, {
    timeout: DEP_CONSTANTS.timeout,
    pollingInterval: DEP_CONSTANTS.pollingInterval,
  });

  const { deployTxReceipt, implAddress, adminAddress, gasUsed, blockNumber } = await getProxyDeployMetadata(proxyContract);

  await go(
    deployTxReceipt.events,
    each(async (tx) => {
      console.log(await tx.getTransaction());
    }),
  );

  log &&
    deployProxyConsole(
      contractName,
      proxyContract.address,
      implAddress,
      adminAddress,
      gasUsed,
      deployTxReceipt.transactionHash,
      blockNumber,
    );

  await writeDeployTmpHistory({
    ...history,
    [contractName]: {
      proxyAddress: proxyContract.address,
      implAddress,
      adminAddress,
      gasUsed: gasUsed.toString(),
      blockNumber: blockNumber.toString(),
    },
  });

  return {
    proxyContract,
    implAddress,
    adminAddress,
    contractFactory,
    gasUsed,
    blockNumber,
  };
};

const deployNormal = async ({ contractName, deploySigner, args = [], log = true }) => {
  const contractFactory = await ethers.getContractFactory(contractName);
  const history = await readDeployTmpHistory();

  // restore deploy result
  if (history[contractName]) {
    log && alreadyDeployedConsole(contractName, history[contractName].address);

    return {
      contract: contractFactory.attach(history[contractName].address),
      ...history[contractName],
    };
  }

  log && console.log(`\n${chalk.magentaBright('Start Deploying:')} ${contractName} - ${new Date()}`);

  const contract = await contractFactory.connect(deploySigner).deploy(...args);
  const txResponse = await contract.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait(DEP_CONSTANTS.confirmWait);
  const { gasUsed, blockNumber } = deployTxReceipt;

  log && deployConsole(contractName, contract.address, gasUsed, txResponse.deployTransaction.hash, blockNumber);

  await writeDeployTmpHistory({
    ...history,
    [contractName]: {
      address: contract.address,
      gasUsed: gasUsed.toString(),
      blockNumber: blockNumber.toString(),
      args,
    },
  });

  return {
    contract,
    gasUsed,
    blockNumber,
    args,
  };
};

const isNotMainOrRinkeby = async (provider) => {
  const { chainId } = await provider.getNetwork();
  return Number(chainId) !== 1 && Number(chainId) !== 4;
};

const createWalletOwnerAccounts = (addressArray, votesArray) => {
  if (addressArray.length !== votesArray.length) throw new Error('Fail to create wallet owner accounts');
  return go(
    zip(addressArray, votesArray),
    map(([addr, vote]) => ({
      addr,
      vote,
    })),
  );
};

module.exports = {
  structurizeProxyData,
  structurizeContractData,
  getProxyDeployMetadata,
  isLocalNetwork,
  deployNormal,
  deployProxy,
  deployBeacon,
  isNotMainOrRinkeby,
  getDateSuffix,
  nullCheck,
  getRPCProvider,
  getChainName,
  tryCatch,
  deployConsole,
  createWalletOwnerAccounts,
  prev_history_file_path,
  writeDeployTmpHistory,
  set1559FeeDataToProvider,
  getSingleFallbackProvider,
  numberCheck,
  queryGasFeeData,
  queryGasDataAndProceed,
};
