const { ethers, upgrades } = require('hardhat');
const { mapC } = require('fxjs');
const { ContractTopic, chainlink, testValues } = require('../../utils/constants.js');

Error.stackTraceLimit = Infinity;

module.exports = {
  createNftContractArgs: (context, { caManagerAddress, prjOwner, maxSupply = 10000, maxMintPerAddress = 10 } = {}) => ({
    uri: 'uri',
    omnuumAddress: context?.accounts?.[0]?.address,
    caManagerAddress,
    maxMintPerAddress,
    maxSupply,
    coverUri: testValues.coverUri,
    prjOwner: prjOwner || context?.accounts?.[0]?.address,
  }),
  deployNFT(beacon, artifact, context, overrideArgs) {
    const args = module.exports.createNftContractArgs(context, overrideArgs);

    return upgrades.deployBeaconProxy(beacon, artifact, [
      args.uri,
      args.caManagerAddress,
      args.omnuumAddress,
      args.maxMintPerAddress,
      args.maxSupply,
      args.coverUri,
      args.prjOwner,
    ]);
  },
  async prepareDeploy() {
    this.OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');
    this.OmnuumNFT1155 = await ethers.getContractFactory('OmnuumNFT1155');
    this.TicketVerifier = await ethers.getContractFactory('TicketVerifier');
    this.SenderVerifier = await ethers.getContractFactory('SenderVerifier');
    this.OmnuumCAManager = await ethers.getContractFactory('OmnuumCAManager');
    this.OmnuumVRFManager = await ethers.getContractFactory('OmnuumVRFManager');
    this.OmnuumExchange = await ethers.getContractFactory('OmnuumExchange');
    this.RevealManager = await ethers.getContractFactory('RevealManager');
    this.NFTbeacon = await upgrades.deployBeacon(this.OmnuumNFT1155);
  },
  async testDeploy(accounts, overrides) {
    this.omnuumCAManager = await upgrades.deployProxy(this.OmnuumCAManager);

    this.revealManager = await this.RevealManager.deploy(this.omnuumCAManager.address);
    await this.revealManager.deployed();

    this.omnuumMintManager = await upgrades.deployProxy(this.OmnuumMintManager, [testValues.mintFee]);

    this.omnuumCAManager.registerContract(this.omnuumMintManager.address, ContractTopic.MINTMANAGER);

    this.senderVerifier = await this.SenderVerifier.deploy();
    await this.senderVerifier.deployed();

    this.ticketVerifier = await this.TicketVerifier.deploy();
    await this.ticketVerifier.deployed();

    this.omnuumVRFManager = await this.OmnuumVRFManager.deploy(
      chainlink.rinkeby.LINK,
      accounts[1].address, // account 1 as vrf coord contract
      chainlink.rinkeby.hash,
      chainlink.rinkeby.fee,
      this.omnuumCAManager.address,
    );
    await this.omnuumVRFManager.deployed();

    this.omnuumNFT1155 = await module.exports.deployNFT(this.NFTbeacon, this.OmnuumNFT1155, this, {
      caManagerAddress: this.omnuumCAManager.address,
      ...overrides,
    });

    this.omnuumExchange = await upgrades.deployProxy(this.OmnuumExchange, [this.omnuumCAManager.address]);

    // register to CA manager
    const registerTxs = await Promise.all([
      this.omnuumCAManager.registerContract(this.omnuumVRFManager.address, ContractTopic.VRF),
      this.omnuumCAManager.registerContract(this.omnuumExchange.address, ContractTopic.EXCHANGE),
      this.omnuumCAManager.registerContract(this.ticketVerifier.address, ContractTopic.TICKET),
      this.omnuumCAManager.registerContract(this.senderVerifier.address, ContractTopic.VERIFIER),
      this.omnuumCAManager.registerContract(this.revealManager.address, ContractTopic.REVEAL),
      this.omnuumCAManager.registerContract(accounts[0].address, ContractTopic.WALLET), // register index 0 address as WALLET
    ]);

    await mapC((tx) => tx.wait(), registerTxs);
  },
};
