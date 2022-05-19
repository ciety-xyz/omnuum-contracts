const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');
const { writeFile, readFile } = require('fs/promises');
const { go, zip, map } = require('fxjs');
const UpgradeableBeacon = require('@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json');
const DEP_CONSTANTS = require('./deployConstants');

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
    case 31337:
      return 'localhost';
    default:
      return 'unrecognized network';
  }
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

const getRPCProvider = async () => {
  const chainName = await getChainName();

  const jsonRpcProvider =
    chainName == 'localhost'
      ? null
      : chainName == 'rinkeby'
      ? process.env.RINKEBY_URL
      : chainName == 'ropsten'
      ? process.env.ROPSTEN_URL
      : null;

  return new ethers.providers.JsonRpcProvider(jsonRpcProvider);
};

const nullCheck = (val) => {
  if (!(val === '')) {
    return true;
  }
  return '🚨 Null is not allowed';
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

  const proxyContract = await upgrades.deployProxy(contractFactory.connect(deploySigner), args, { timeout: 600000 });
  const { deployTxReceipt, implAddress, adminAddress, gasUsed, blockNumber } = await getProxyDeployMetadata(proxyContract);

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
};
