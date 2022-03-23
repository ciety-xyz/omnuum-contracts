const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');

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
      return 'local';
    default:
      return 'unrecognized network';
  }
};

const structurizeProxyData = (deployObj) => ({
  proxy: deployObj.proxyContract.address,
  impl: deployObj.implAddress,
  admin: deployObj.adminAddress,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
  blockNumber: ethers.BigNumber.from(deployObj.blockNumber).toNumber(),
});

const structurizeContractData = (deployObj) => ({
  contract: deployObj.contract.address,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
  blockNumber: ethers.BigNumber.from(deployObj.blockNumber).toNumber(),
});

const isLocalNetwork = async (provider) => {
  const { chainId } = await provider.getNetwork();
  return Number(chainId) !== 1 && Number(chainId) !== 4;
};

const getRPCProvider = async (provider) =>
  (await isLocalNetwork(provider)) ? new ethers.providers.JsonRpcProvider() : new ethers.providers.JsonRpcProvider(process.env.RINKEBY_URL);

const nullCheck = (val) => {
  if (!(val === '')) {
    return true;
  }
  return '🚨 Null is not allowed';
};

const getDateSuffix = () =>
  `${new Date().toLocaleDateString().replaceAll('/', '-')}_${new Date().toLocaleTimeString('en', { hour12: false })}`;

const deployConsoleRow = (title, data) => `  ${chalk.blue(title)} ${data}\n`;

const deployBeaconConsole = (contractName, beaconAddr, ImplAddr, gasUsed, txHash, blockNumber) =>
  console.log(
    `\n${chalk.green(`<${contractName}>`)}\n${[
      deployConsoleRow('Block', blockNumber),
      deployConsoleRow('TxHash', txHash),
      deployConsoleRow('BeaconContractAddress', beaconAddr),
      deployConsoleRow('Impl', ImplAddr),
      deployConsoleRow('GasUsed', gasUsed),
    ].join('')}`
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
    ].join('')}`
  );

const deployConsole = (contractName, deployAddress, gasUsed, txHash, blockNumber) =>
  console.log(
    `\n${chalk.green(`<${contractName}>`)}\n${[
      deployConsoleRow('Block', blockNumber),
      deployConsoleRow('TxHash', txHash),
      deployConsoleRow('contractAddress', deployAddress),
      deployConsoleRow('GasUsed', gasUsed),
    ].join('')}`
  );

const deployBeacon = async ({ contractName, deploySigner, log = true }) => {
  const contractFactory = await ethers.getContractFactory(contractName);
  const beacon = await upgrades.deployBeacon(contractFactory.connect(deploySigner));
  const txResponse = await beacon.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait();
  const implAddress = await upgrades.beacon.getImplementationAddress(beacon.address);
  const { gasUsed, blockNumber } = deployTxReceipt;

  log && deployBeaconConsole(contractName, beacon.address, implAddress, gasUsed, txResponse.deployTransaction.hash, blockNumber);
  return {
    beacon,
    implAddress,
    contractFactory,
  };
};

const deployProxy = async ({ contractName, deploySigner, args = [], log = true }) => {
  log && console.log(`\n${chalk.blue('Start Deploying:')} ${contractName} - ${new Date()}`);

  const contractFactory = await ethers.getContractFactory(contractName);
  const proxyContract = await upgrades.deployProxy(contractFactory.connect(deploySigner), args, { timeout: 600000 });
  const txResponse = await proxyContract.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyContract.address);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyContract.address);
  const { gasUsed, blockNumber } = deployTxReceipt;
  log &&
    deployProxyConsole(
      contractName,
      proxyContract.address,
      implAddress,
      adminAddress,
      gasUsed,
      txResponse.deployTransaction.hash,
      blockNumber
    );
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
  log && console.log(`\n${chalk.blue('Start Deploying:')} ${contractName} - ${new Date()}`);
  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory.connect(deploySigner).deploy(...args);
  const txResponse = await contract.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait();
  const { gasUsed, blockNumber } = deployTxReceipt;
  log && deployConsole(contractName, contract.address, gasUsed, txResponse.deployTransaction.hash, blockNumber);
  return {
    contract,
    gasUsed,
    blockNumber,
  };
};

const isNotMainOrRinkeby = async (provider) => {
  const { chainId } = await provider.getNetwork();
  return Number(chainId) !== 1 && Number(chainId) !== 4;
};

module.exports = {
  structurizeProxyData,
  structurizeContractData,
  isLocalNetwork,
  deployNormal,
  deployProxy,
  deployBeacon,
  isNotMainOrRinkeby,
  getDateSuffix,
  nullCheck,
  getRPCProvider,
  getChainName,
};
