const { ethers, upgrades } = require('hardhat');

const deployBeaconConsole = (contractName, beaconAddr, ImplAddr) =>
    console.log(`\n<${contractName}>\n  Beacon ${beaconAddr}\n  Impl ${ImplAddr}\n`);

const deployProxyConsole = (contractName, proxyAddr, ImplAddr, adminAddress, gasUsed) =>
    console.log(`\n<${contractName}>\n  Proxy ${proxyAddr}\n  Impl ${ImplAddr}\n  Admin ${adminAddress}\n  GasUsed ${gasUsed}`);

const deployConsole = (contractName, deployAddress) => console.log(`\n<${contractName}>\n  Deploy ${deployAddress}`);

const deployBeacon = async ({ contractName, deploySigner, log = true }) => {
    const contractFactory = await ethers.getContractFactory(contractName);
    const beacon = await upgrades.deployBeacon(contractFactory.connect(deploySigner));
    await beacon.deployed();
    const implAddress = await upgrades.beacon.getImplementationAddress(beacon.address);
    log && deployBeaconConsole(contractName, beacon.address, implAddress);
    return {
        beacon,
        implAddress,
        contractFactory,
    };
};

const deployProxy = async ({ contractName, deploySigner, args = [], log = true }) => {
    const contractFactory = await ethers.getContractFactory(contractName);
    const proxyContract = await upgrades.deployProxy(contractFactory.connect(deploySigner), args);
    const txResponse = await proxyContract.deployed();
    const deployTxReceipt = await txResponse.deployTransaction.wait();
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyContract.address);
    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyContract.address);
    log && deployProxyConsole(contractName, proxyContract.address, implAddress, adminAddress, deployTxReceipt.gasUsed);
    return {
        proxyContract,
        implAddress,
        contractFactory,
    };
};

const deployNormal = async ({ contractName, deploySigner, args = [], log = true }) => {
    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = await contractFactory.connect(deploySigner).deploy(...args);
    await contract.deployed();
    log && deployConsole(contractName, contract.address);
    return {
        contract,
    };
};

const isNotMainOrRinkeby = async (provider) => {
    const { chainId } = await provider.getNetwork();
    return chainId != 1 && chainId != 4;
};

module.exports = { deployNormal, deployProxy, deployBeacon, isNotMainOrRinkeby };
