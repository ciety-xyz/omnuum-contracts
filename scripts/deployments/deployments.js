const { upgrades } = require('hardhat');
const { chainlink, ContractTopic, testValues } = require('../../utils/constants');
const { deployProxy, deployNormal, deployBeacon } = require('./deployHelper');

const deployNFT = async ({ nftBeacon, nftContractFactory, caManageProxyAddr, devDeployerAddr, maxSupply, coverUri, projectOwnerAddr }) => {
  /* Deploy NFT1155 Beacon Proxy */
  const nftBeaconProxy = await upgrades.deployBeaconProxy(nftBeacon, nftContractFactory, [
    caManageProxyAddr,
    devDeployerAddr,
    maxSupply,
    coverUri,
    projectOwnerAddr,
  ]);
  const deployReceipt = await nftBeaconProxy.deployed();
  return { beaconProxy: nftBeaconProxy, deployReceipt };
};

const deployments = async ({ devDeployer, owners }) => {
  // /* Deploy CA Manager */
  const caManager = await deployProxy({
    contractName: 'OmnuumCAManager',
    deploySigner: devDeployer,
  });

  // register itself
  await (await caManager.proxyContract.registerContract(caManager.proxyContract.address, ContractTopic.CAMANAGER)).wait();

  /* Deploy Mint Manager */
  const mintManager = await deployProxy({
    contractName: 'OmnuumMintManager',
    deploySigner: devDeployer,
    args: [testValues.baseFeeRate], // _feeRate: 5.000 %
  });

  /* Deploy Exchange */
  const exchanger = await deployProxy({
    contractName: 'OmnuumExchange',
    deploySigner: devDeployer,
    args: [caManager.proxyContract.address],
  });

  /* Deploy Ticket Manager */
  const ticketManager = await deployNormal({
    contractName: 'TicketManager',
    deploySigner: devDeployer,
  });

  /* Deploy Reveal Manager */
  const revealManager = await deployNormal({
    contractName: 'RevealManager',
    deploySigner: devDeployer,
    args: [caManager.proxyContract.address], // CA manager
  });

  /* Deploy Sender Verifier */
  const senderVerifier = await deployNormal({
    contractName: 'SenderVerifier',
    deploySigner: devDeployer,
  });

  /* Deploy VRF Manager */
  const vrfManager = await deployNormal({
    contractName: 'OmnuumVRFManager',
    deploySigner: devDeployer,
    args: [...Object.values(chainlink.rinkeby), caManager.proxyContract.address], // Chainlink constants,  CA manager
  });

  /* Deploy Wallet */
  const wallet = await deployNormal({
    contractName: 'OmnuumWallet',
    deploySigner: devDeployer,
    args: [owners.map((signer) => signer.address)],
  });

  /* Deploy NFT1155 Beacon */
  const nft = await deployBeacon({
    contractName: 'OmnuumNFT1155',
    deploySigner: devDeployer,
  });

  /* Register CA accounts to CA Manager */
  await (
    await caManager.proxyContract.registerContractMultiple(
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
      ]
    )
  ).wait();

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

module.exports = { deployNFT, deployManagers: deployments };
