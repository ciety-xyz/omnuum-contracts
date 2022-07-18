const { ethers, upgrades } = require('hardhat');
const { readFile, readdir, writeFile } = require('fs/promises');
const { filter, pick, head, go } = require('fxjs');
const chalk = require('chalk');
const UpgradeableBeacon = require('@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json');
const {
  getChainName,
  getRPCProvider,
  getProxyDeployMetadata,
  structurizeProxyData,
  structurizeContractData,
  createWalletOwnerAccounts,
  getDateSuffix,
} = require('../../deployments/deployHelper.js');
const DEP_CONSTANTS = require('../../deployments/deployConstants.js');
const CONSTANTS = require('../../../utils/constants.js');
const { s3Upload, s3Get } = require('../../../utils/s3.js');
const { getWalletFromMnemonic } = require('../../../utils/walletFromMnemonic.js');

const getDeployReceipt = async (contract) => {
  const response = await contract.deployed();
  return contract.deployTransaction.wait();
};

const getTxReceipt = async (tx) => tx.wait();

const logDeployComplete = (contractName) => console.log(`${chalk.green('Deploy Complete:')} ${contractName} (${new Date()})`);

async function main(signatureSignerAddress, gasPrices) {
  try {
    // config
    let provider;
    if (gasPrices) {
      // Wrap the provider so we can override fee data.
      provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
      const FEE_DATA = {
        maxFeePerGas: ethers.utils.parseUnits(gasPrices.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits(gasPrices.maxPriorityFeePerGas, 'gwei'),
      };
      provider.getFeeData = async () => FEE_DATA;
    } else {
      provider = await getRPCProvider();
    }

    const chainName = await getChainName();

    const OmnuumDeployer = chainName === 'localhost' ? (await ethers.getSigners())[0] : await getWalletFromMnemonic(provider);

    const deployed = await go(
      readdir('./deploy_history'),
      filter((filename) => filename.includes(chainName)),
      head,
      (deploy_filename) => readFile(`./deploy_history/${deploy_filename}`, 'utf8'),
      (a) => JSON.parse(a),
    );

    const walletOwnerAccounts = createWalletOwnerAccounts(
      chainName === 'localhost' ? (await ethers.getSigners()).slice(1, 6).map((x) => x.address) : DEP_CONSTANTS.wallet.ownerAddresses,
      DEP_CONSTANTS.wallet.ownerLevels,
    );

    // prepare openzeppelin
    // const abi = await s3Get({
    //   bucketName: 'omnuum-prod-website-resources',
    //   keyName: 'contracts/OmnuumMintManager.json',
    // });
    //
    // const PrevMintManagerContractFactory = new ethers.ContractFactory();
    //
    // await upgrades.forceImport(deployed.mintManager.proxy);

    // Main logic
    const omnuumCAManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(deployed.caManager.address);

    // deploy
    const RevealManager = await ethers.getContractFactory('RevealManager');
    const OmnuumWallet = await ethers.getContractFactory('OmnuumWallet');
    const OmnuumNFT721 = await ethers.getContractFactory('OmnuumNFT721');
    const NftFactory = await ethers.getContractFactory('NftFactory');
    const OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');

    const revealDeployArgs = [deployed.caManager.address];
    // const revealManager = await RevealManager.attach('0xb2cff4c533c95fd5b77ad246539afc5751fa2b4b');
    const revealManager = await RevealManager.connect(OmnuumDeployer).deploy(...revealDeployArgs);
    const revealManagerReceipt = await getDeployReceipt(revealManager);
    //
    logDeployComplete('reveal');
    //
    const walletDeployArgs = [DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, walletOwnerAccounts];
    // const omnuumWallet = await OmnuumWallet.attach('0x6dec671d53f33a4a7314ea596a8e892f18ecec91');
    const omnuumWallet = await OmnuumWallet.connect(OmnuumDeployer).deploy(...walletDeployArgs);
    const omnuumWalletReceipt = await getDeployReceipt(omnuumWallet);
    //
    logDeployComplete('wallet');
    //
    const omnuumNFT721 = await upgrades.deployBeacon(OmnuumNFT721.connect(OmnuumDeployer));
    // const omnuumNFT721 = (await ethers.getContractFactory(UpgradeableBeacon.abi, UpgradeableBeacon.bytecode)).attach(
    //   '0xd4d7fd222ccc3b574cd6ca7df632df1db09ad388',
    // );
    const omnuumNFT721Receipt = await getDeployReceipt(omnuumNFT721);
    const omnuumNFT721implementation = await upgrades.beacon.getImplementationAddress(omnuumNFT721.address);

    logDeployComplete('nft beacon');

    const factoryDeployArgs = [deployed.caManager.address, omnuumNFT721.address, signatureSignerAddress];
    const nftFactory = await NftFactory.connect(OmnuumDeployer).deploy(...factoryDeployArgs);
    const nftFactoryReceipt = await getDeployReceipt(nftFactory);

    logDeployComplete('factory');

    const omnuumMintManager = await upgrades.upgradeProxy(deployed.mintManager.proxy, OmnuumMintManager.connect(OmnuumDeployer));
    const omnuumMintManagerMetadata = await getProxyDeployMetadata(omnuumMintManager);

    logDeployComplete('mint manager');

    /*
      Register to CA manger
     */

    const registerReceipt = await getTxReceipt(
      await omnuumCAManager
        .connect(OmnuumDeployer)
        .registerContractMultiple(
          [revealManager.address, omnuumWallet.address, nftFactory.address],
          [CONSTANTS.ContractTopic.REVEAL, CONSTANTS.ContractTopic.WALLET, CONSTANTS.ContractTopic.NFTFACTORY],
        ),
    );

    console.log('Register Complete');

    const roleReceipt = await getTxReceipt(
      await omnuumCAManager.connect(OmnuumDeployer).addRole([revealManager.address], DEP_CONSTANTS.roles.VRF),
    );

    console.log('Add role Complete');

    /*
     Check registered contracts & role
     */

    const indexed_reveal = await omnuumCAManager.getContract(CONSTANTS.ContractTopic.REVEAL);
    if (indexed_reveal !== revealManager.address) {
      throw new Error(
        `reveal manager is not registered: prev (${deployed.revealManager.address}), cur(${revealManager.address}), indexed(${indexed_reveal})`,
      );
    }

    const indexed_wallet = await omnuumCAManager.getContract(CONSTANTS.ContractTopic.WALLET);
    if (indexed_wallet !== omnuumWallet.address) {
      throw new Error(
        `wallet is not registered: prev (${deployed.wallet.address}), cur(${omnuumWallet.address}), indexed(${indexed_wallet})`,
      );
    }

    const indexed_factory = await omnuumCAManager.getContract(CONSTANTS.ContractTopic.NFTFACTORY);
    if (indexed_factory !== nftFactory.address) {
      throw new Error(
        `factory is not registered: prev (${deployed.nftFactory.address}), cur(${nftFactory.address}), indexed(${indexed_factory})`,
      );
    }

    const check_role = await omnuumCAManager.hasRole(revealManager.address, DEP_CONSTANTS.roles.VRF);
    if (!check_role) {
      throw new Error('RevealManager don`t have role VRF');
    }

    const new_implementation_address_mintManager = await upgrades.erc1967.getImplementationAddress(deployed.mintManager.proxy);
    if (new_implementation_address_mintManager == deployed.mintManager.impl) {
      throw new Error(`Upgraded implementation is not changed!! (mintManager), impl(${deployed.mintManager.impl})`);
    }

    const resultData = {
      network: chainName,
      deployStartAt: new Date().toLocaleTimeString(),
      deployer: OmnuumDeployer.address,
      revealManager: structurizeContractData({
        contract: revealManager,
        ...pick(['gasUsed', 'blockNumber'], revealManagerReceipt),
        args: revealDeployArgs,
      }),
      wallet: structurizeContractData({
        contract: omnuumWallet,
        ...pick(['gasUsed', 'blockNumber'], omnuumWalletReceipt),
        args: walletDeployArgs,
      }),
      nftFactory: structurizeContractData({
        contract: nftFactory,
        ...pick(['gasUsed', 'blockNumber'], nftFactoryReceipt),
        args: factoryDeployArgs,
      }),
      nft721: {
        impl: omnuumNFT721implementation,
        beacon: omnuumNFT721.address,
        address: omnuumNFT721.address,
      },
      mintManager: structurizeProxyData({
        proxyContract: omnuumMintManager,
        ...omnuumMintManagerMetadata,
      }),
    };

    const filename = `${chainName}_${getDateSuffix()}.json`;
    await writeFile(`./scripts/deploy_history/${filename}`, JSON.stringify(resultData), 'utf8');

    // upgrade
  } catch (err) {
    console.log(err);
  }
}

// main('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
main('0x81876853baef4001B844B11dF010E9647b7c9a2b', { maxFeePerGas: '21', maxPriorityFeePerGas: '4' });
