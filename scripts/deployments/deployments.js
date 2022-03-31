const { upgrades } = require('hardhat');
const chalk = require('chalk');
const { ContractTopic } = require('../../utils/constants');
const DEP_CONSTANTS = require('./deployConstants');
const { deployProxy, deployNormal, deployBeacon, getChainName } = require('./deployHelper');

const deployNFT = async ({
  nftBeacon,
  nftContractFactory,
  caManageProxyAddr,
  devDeployerAddr,
  maxSupply,
  coverUri,
  projectOwnerAddress,
}) => {
  /* Deploy NFT1155 Beacon Proxy */
  const nftBeaconProxy = await upgrades.deployBeaconProxy(
    nftBeacon,
    nftContractFactory,
    [caManageProxyAddr, devDeployerAddr, maxSupply, coverUri, projectOwnerAddress],
    { pollingInterval: DEP_CONSTANTS.pollingInterval },
  );
  const deployReceipt = await (await nftBeaconProxy.deployed()).deployTransaction.wait();
  return { beaconProxy: nftBeaconProxy, deployReceipt };
};

const deployManagers = async ({ deploySigner }) => {
  /* Deploy CA Manager */
  const caManager = await deployProxy({
    contractName: 'OmnuumCAManager',
    deploySigner,
  });

  /* Register CA Manager itself */

  await (
    await caManager.proxyContract
      .connect(deploySigner)
      .registerContract(caManager.proxyContract.address, DEP_CONSTANTS.caManager.topic, { gasLimit: 10_000_000 })
  ).wait();
  console.log(`\n${chalk.yellow('Complete self-registration to CA Manager')} - ${new Date()}`);

  /* Deploy Mint Manager */
  const mintManager = await deployProxy({
    contractName: 'OmnuumMintManager',
    deploySigner,
    args: [DEP_CONSTANTS.mintManager.feeRate],
  });

  /* Deploy Exchange */
  const exchanger = await deployProxy({
    contractName: 'OmnuumExchange',
    deploySigner,
    args: [caManager.proxyContract.address],
  });

  /* Deploy Ticket Manager */
  const ticketManager = await deployNormal({
    contractName: 'TicketManager',
    deploySigner,
  });

  /* Deploy Reveal Manager */
  const revealManager = await deployNormal({
    contractName: 'RevealManager',
    deploySigner,
    args: [caManager.proxyContract.address],
  });

  /* Deploy Sender Verifier */
  const senderVerifier = await deployNormal({
    contractName: 'SenderVerifier',
    deploySigner,
  });

  /* Deploy VRF Manager */
  const vrfManager = await deployNormal({
    contractName: 'OmnuumVRFManager',
    deploySigner,
    args: [...Object.values(DEP_CONSTANTS.vrfManager.chainlink[await getChainName()]), caManager.proxyContract.address],
  });

  /* Deploy Wallet */
  const wallet = await deployNormal({
    contractName: 'OmnuumWallet',
    deploySigner,
    args: [DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, DEP_CONSTANTS.wallet.ownerAccounts],
  });

  /* Deploy NFT1155 Beacon */
  const nft = await deployBeacon({
    contractName: 'OmnuumNFT1155',
    deploySigner,
  });

  /* Register CA accounts to CA Manager */
  await (
    await caManager.proxyContract
      .connect(deploySigner)
      .registerContractMultiple(
        [
          mintManager.proxyContract.address,
          exchanger.proxyContract.address,
          ticketManager.contract.address,
          revealManager.contract.address,
          senderVerifier.contract.address,
          vrfManager.contract.address,
          wallet.contract.address,
        ],
        [
          ContractTopic.MINTMANAGER,
          ContractTopic.EXCHANGE,
          ContractTopic.TICKET,
          ContractTopic.REVEAL,
          ContractTopic.VERIFIER,
          ContractTopic.VRF,
          ContractTopic.WALLET,
        ],
      )
  ).wait();

  console.log(`\n${chalk.yellow('Complete Contract Registrations to CA Manager')} - ${new Date()}`);

  /* Register contract roles to CA manager */
  /* VRF manager => EXCHANGE role */
  /* Reveal manager => VRF role */
  await (await caManager.proxyContract.connect(deploySigner).addRole([vrfManager.contract.address], DEP_CONSTANTS.roles.vrfManager)).wait();
  await (
    await caManager.proxyContract.connect(deploySigner).addRole([revealManager.contract.address], DEP_CONSTANTS.roles.revealManager)
  ).wait();

  console.log(`\n${chalk.yellow('Complete Role Additions to CA Manager')} - ${new Date()}`);

  return {
    nft,
    vrfManager,
    mintManager,
    caManager,
    exchanger,
    ticketManager,
    senderVerifier,
    revealManager,
    wallet,
  };
};

module.exports = { deployNFT, deployManagers };