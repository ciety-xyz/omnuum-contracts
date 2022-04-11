const { ethers } = require('hardhat');
const chalk = require('chalk');
const { go } = require('fxjs');
const CONSTANTS = require('../../utils/constants');
const DEP_CONSTANTS = require('./deployConstants');
const { deployProxy, deployNormal, deployBeacon, getChainName } = require('./deployHelper');
const { getPayloadWithSignature } = require('../interactions/interactionHelpers');

const deployNFT = async ({
  projectOwnerSigner,
  signerPrivateKey,
  senderVerifierAddress,
  maxSupply,
  coverUri,
  nftFactoryAddress,
  collectionId,
}) => {
  /* Deploy NFT1155 Beacon Proxy */
  const NftFactory = await ethers.getContractFactory('NftFactory');

  // in this case, minterAddress means nft project owner
  const payload = await getPayloadWithSignature({
    senderVerifierAddress,
    minterAddress: projectOwnerSigner.address,
    payloadTopic: CONSTANTS.payloadTopic.deployCol,
    groupId: collectionId,
    signerPrivateKey,
  });

  const txResponse = await NftFactory.attach(nftFactoryAddress)
    .connect(projectOwnerSigner)
    .deploy(maxSupply, coverUri, collectionId, payload);
  const deployReceipt = await txResponse.wait();

  const { logs } = deployReceipt;

  const {
    args: { nftContract: beaconProxyAddress },
  } = NftFactory.interface.parseLog(logs[logs.length - 1]);

  return { beaconProxyAddress, deployReceipt };
};

const deployManagers = async ({ deploySigner, signatureSignerAddress, walletOwnerAccounts }) => {
  /* Deploy CA Manager */
  const caManager = await deployProxy({
    contractName: 'OmnuumCAManager',
    deploySigner,
  });

  /* Register CA Manager itself */
  await (
    await caManager.proxyContract.connect(deploySigner).registerContract(caManager.proxyContract.address, DEP_CONSTANTS.caManager.topic)
  ).wait(DEP_CONSTANTS.confirmWait);
  console.log(`\n${chalk.yellow('Complete self-registration to CA Manager')} - ${new Date()}`);

  /* Deploy Mint Manager */
  const mintManager = await deployProxy({
    contractName: 'OmnuumMintManager',
    deploySigner,
    args: [DEP_CONSTANTS.mintManager.feeRate],
  });

  /* Deploy Exchange */
  const exchange = await deployProxy({
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
    args: [DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, walletOwnerAccounts],
  });

  /* Deploy NFT1155 Beacon */
  const nft = await deployBeacon({
    contractName: 'OmnuumNFT1155',
    deploySigner,
  });

  const nftFactory = await deployNormal({
    contractName: 'NftFactory',
    deploySigner,
    args: [caManager.proxyContract.address, nft.beacon.address, signatureSignerAddress],
  });

  /* Register CA accounts to CA Manager */
  console.log(`\n${chalk.green('Start Contract Registrations to CA Manager...')} - ${new Date()}`);
  await (
    await caManager.proxyContract
      .connect(deploySigner)
      .registerContractMultiple(
        [
          mintManager.proxyContract.address,
          exchange.proxyContract.address,
          ticketManager.contract.address,
          revealManager.contract.address,
          senderVerifier.contract.address,
          vrfManager.contract.address,
          wallet.contract.address,
          nftFactory.contract.address,
        ],
        [
          CONSTANTS.ContractTopic.MINTMANAGER,
          CONSTANTS.ContractTopic.EXCHANGE,
          CONSTANTS.ContractTopic.TICKET,
          CONSTANTS.ContractTopic.REVEAL,
          CONSTANTS.ContractTopic.VERIFIER,
          CONSTANTS.ContractTopic.VRF,
          CONSTANTS.ContractTopic.WALLET,
          CONSTANTS.ContractTopic.NFTFACTORY,
        ],
      )
  ).wait(DEP_CONSTANTS.confirmWait);
  console.log(`${chalk.yellow('Complete!')} - ${new Date()}`);

  /* Register contract roles to CA manager */
  /* VRF manager => EXCHANGE role */
  /* Reveal manager => VRF role */

  console.log(`\n${chalk.green('Start Role Additions to CA Manager...')} - ${new Date()}`);
  await (await caManager.proxyContract.connect(deploySigner).addRole([vrfManager.contract.address], DEP_CONSTANTS.roles.vrfManager)).wait();
  await (
    await caManager.proxyContract.connect(deploySigner).addRole([revealManager.contract.address], DEP_CONSTANTS.roles.revealManager)
  ).wait(DEP_CONSTANTS.confirmWait);
  console.log(`${chalk.yellow('Complete!')} - ${new Date()}`);

  return {
    nft,
    nftFactory,
    vrfManager,
    mintManager,
    caManager,
    exchange,
    ticketManager,
    senderVerifier,
    revealManager,
    wallet,
  };
};

module.exports = { deployNFT, deployManagers };
