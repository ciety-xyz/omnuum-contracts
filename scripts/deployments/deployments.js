const { ethers } = require('hardhat');
const chalk = require('chalk');
const inquirer = require('inquirer');
const CONSTANTS = require('../../utils/constants');
const DEP_CONSTANTS = require('./deployConstants');
const {
  deployProxy,
  deployNormal,
  deployBeacon,
  getChainName,
  nullCheck,
  queryGasFeeData,
  registerContractsToCAManager,
  registerRoleToCAManager,
} = require('./deployHelper');
const { getPayloadWithSignature } = require('../interactions/interactionHelpers');

const deployManagers = async ({ deploySigner, signatureSignerAddress, walletOwnerAccounts, maxFeePerGasLimit, gasModeAuto }) => {
  /* Deploy CA Manager */
  const caManager = await deployProxy({
    contractName: 'OmnuumCAManager',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
  });

  // /* Register CA Manager itself */
  // await (
  //   await caManager.proxyContract.connect(deploySigner).registerContract(caManager.proxyContract.address, DEP_CONSTANTS.caManager.topic)
  // ).wait(DEP_CONSTANTS.confirmWait);
  // console.log(`\n${chalk.yellow('Complete self-registration to CA Manager')} - ${new Date()}`);

  /* Deploy Mint Manager */
  const mintManager = await deployProxy({
    contractName: 'OmnuumMintManager',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [DEP_CONSTANTS.mintManager.feeRate, caManager.proxyContract.address],
  });

  /* Deploy Exchange */
  const exchange = await deployProxy({
    contractName: 'OmnuumExchange',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [caManager.proxyContract.address],
  });

  /* Deploy Ticket Manager */
  const ticketManager = await deployNormal({
    contractName: 'TicketManager',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
  });

  /* Deploy Reveal Manager */
  const revealManager = await deployNormal({
    contractName: 'RevealManager',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [caManager.proxyContract.address],
  });

  /* Deploy Sender Verifier */
  const senderVerifier = await deployNormal({
    contractName: 'SenderVerifier',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
  });

  /* Deploy VRF Manager */
  const vrfManager = await deployNormal({
    contractName: 'OmnuumVRFManager',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [...Object.values(DEP_CONSTANTS.vrfManager.chainlink[await getChainName()]), caManager.proxyContract.address],
  });

  /* Deploy Wallet */
  const wallet = await deployNormal({
    contractName: 'OmnuumWallet',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, walletOwnerAccounts],
  });

  /* Deploy NFT721 Beacon */
  const nft = await deployBeacon({
    contractName: 'OmnuumNFT721',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
  });

  const nftFactory = await deployNormal({
    contractName: 'NftFactory',
    deploySigner,
    gasModeAuto,
    maxFeePerGasLimit,
    args: [caManager.proxyContract.address, nft.beacon.address, signatureSignerAddress],
  });

  await registerContractsToCAManager({
    caManagerInstance: caManager.proxyContract,
    deployer: deploySigner,
    addresses: [
      mintManager.proxyContract.address,
      exchange.proxyContract.address,
      ticketManager.contract.address,
      revealManager.contract.address,
      senderVerifier.contract.address,
      vrfManager.contract.address,
      wallet.contract.address,
      nftFactory.contract.address,
    ],
    topics: [
      CONSTANTS.ContractTopic.MINTMANAGER,
      CONSTANTS.ContractTopic.EXCHANGE,
      CONSTANTS.ContractTopic.TICKET,
      CONSTANTS.ContractTopic.REVEAL,
      CONSTANTS.ContractTopic.VERIFIER,
      CONSTANTS.ContractTopic.VRF,
      CONSTANTS.ContractTopic.WALLET,
      CONSTANTS.ContractTopic.NFTFACTORY,
    ],
    gasModeAuto,
    maxFeePerGasLimit,
  });

  await registerRoleToCAManager({
    caManagerInstance: caManager.proxyContract,
    deployer: deploySigner,
    addresses: [vrfManager.contract.address],
    roleTopic: DEP_CONSTANTS.roles.EXCHANGE,
    gasModeAuto,
    maxFeePerGasLimit,
  });

  await registerRoleToCAManager({
    caManagerInstance: caManager.proxyContract,
    deployer: deploySigner,
    addresses: [revealManager.contract.address],
    roleTopic: DEP_CONSTANTS.roles.VRF,
    gasModeAuto,
    maxFeePerGasLimit,
  });

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

const deployNFT = async ({
  projectOwnerSigner,
  signerPrivateKey,
  senderVerifierAddress,
  maxSupply,
  coverUri,
  nftFactoryAddress,
  collectionId,
  name,
  symbol,
}) => {
  /* Deploy NFT721 Beacon Proxy */
  const NftFactory = await ethers.getContractFactory('NftFactory');

  // in this case, minterAddress means nft project owner
  const payload = await getPayloadWithSignature({
    senderVerifierAddress,
    minterAddress: projectOwnerSigner.address,
    payloadTopic: CONSTANTS.payloadTopic.deployCol,
    groupId: collectionId,
    signerPrivateKey,
  });

  const gasFeeData = await queryGasFeeData();
  const {
    raw: { maxFeePerGas, maxPriorityFeePerGas },
  } = gasFeeData;

  console.log(`⛽️ Real-time Gas Fee from ${await getChainName()}`);
  console.dir(gasFeeData, { depth: 5 });

  const { proceed } = await inquirer.prompt([
    {
      name: 'proceed',
      type: 'confirm',
      message: '🤔 proceed ?',
      validate: nullCheck,
    },
  ]);
  if (!proceed) {
    console.log('Transaction Aborted!');
    return;
  }

  const tx = await NftFactory.attach(nftFactoryAddress)
    .connect(projectOwnerSigner)
    .deploy(maxSupply, coverUri, collectionId, name, symbol, payload, {
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

  console.log('🔑 Transaction');
  console.dir(tx, { depth: 10 });

  const deployReceipt = await tx.wait();

  const { logs } = deployReceipt;

  // filter event emitted by NFT Factory => where having nft contract address
  const factoryEvt = logs.filter((event) => event.address === nftFactoryAddress)[0];

  const abiCoder = ethers.utils.defaultAbiCoder;

  const beaconProxyAddress = abiCoder.decode(['address'], factoryEvt.topics[1]);

  return { beaconProxyAddress, deployReceipt };
};

module.exports = { deployNFT, deployManagers };
