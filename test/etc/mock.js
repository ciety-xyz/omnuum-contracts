const { ethers, upgrades } = require('hardhat');
const { mapC, go, zip, map } = require('fxjs');
const { ContractTopic, chainlink, testValues, contractRole } = require('../../utils/constants.js');

Error.stackTraceLimit = Infinity;

module.exports = {
  createNftContractArgs: (context, { caManagerAddress, prjOwner, maxSupply = 10000 } = {}) => ({
    omnuumAddress: context?.accounts?.[0]?.address,
    caManagerAddress,
    maxSupply,
    coverUri: testValues.coverUri,
    prjOwner: prjOwner || context?.accounts?.[0]?.address,
  }),
  deployNFT(beacon, artifact, context, overrideArgs) {
    const args = module.exports.createNftContractArgs(context, overrideArgs);

    return upgrades.deployBeaconProxy(beacon, artifact, [
      args.caManagerAddress,
      args.omnuumAddress,
      args.maxSupply,
      args.coverUri,
      args.prjOwner,
    ]);
  },
  async prepareDeploy() {
    this.OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');
    this.OmnuumNFT1155 = await ethers.getContractFactory('OmnuumNFT1155');
    this.TicketManager = await ethers.getContractFactory('TicketManager');
    this.SenderVerifier = await ethers.getContractFactory('SenderVerifier');
    this.OmnuumCAManager = await ethers.getContractFactory('OmnuumCAManager');
    this.OmnuumVRFManager = await ethers.getContractFactory('OmnuumVRFManager');
    this.OmnuumExchange = await ethers.getContractFactory('OmnuumExchange');
    this.RevealManager = await ethers.getContractFactory('RevealManager');
    this.OmnuumWallet = await ethers.getContractFactory('OmnuumWallet');
    this.NFTbeacon = await upgrades.deployBeacon(this.OmnuumNFT1155);
  },
  async prepareMockDeploy() {
    this.MockLink = await ethers.getContractFactory('MockLink');
    this.MockVrfCoords = await ethers.getContractFactory('MockVrfCoords');
    this.MockNFT = await ethers.getContractFactory('MockNFT');
    this.MockExchange = await ethers.getContractFactory('MockExchange');
    this.MockVrfRequester = await ethers.getContractFactory('MockVrfRequester');
  },
  async testDeploy(accounts, overrides) {
    /* Deploy Upgradeable Proxies */
    this.omnuumCAManager = await upgrades.deployProxy(this.OmnuumCAManager);
    this.omnuumMintManager = await upgrades.deployProxy(this.OmnuumMintManager, [testValues.feeRate]);
    this.omnuumExchange = await upgrades.deployProxy(this.OmnuumExchange, [this.omnuumCAManager.address]);

    /* Deploy Contracts */
    this.walletOwnerSigner = accounts.slice(-5);
    this.walletOwnerAccounts = go(
      this.walletOwnerSigner,
      zip([2, 2, 1, 1, 1]),
      map(([vote, signer]) => ({ addr: signer.address, vote })),
    );

    this.omnuumWallet = await this.OmnuumWallet.deploy(this.walletOwnerAccounts);
    this.revealManager = await this.RevealManager.deploy(this.omnuumCAManager.address);
    [this.senderVerifier, this.ticketManager, this.mockLink, this.mockVrfCoords, this.mockVrfRequester, this.mockExchange] = await go(
      [this.SenderVerifier, this.TicketManager, this.MockLink, this.MockVrfCoords, this.MockVrfRequester, this.MockExchange],
      mapC(async (conFactory) => {
        const contract = await conFactory.deploy();
        await contract.deployed();
        return contract;
      }),
    );

    /* Deploy VRF Manager */
    this.omnuumVRFManager = await this.OmnuumVRFManager.deploy(
      this.mockLink.address,
      this.mockVrfCoords.address,
      chainlink.rinkeby.hash,
      chainlink.rinkeby.fee,
      this.omnuumCAManager.address,
    );

    /* Register CA accounts to CA Manager */
    await (
      await this.omnuumCAManager.registerContractMultiple(
        [
          this.omnuumVRFManager.address,
          this.omnuumMintManager.address,
          this.omnuumExchange.address,
          this.ticketManager.address,
          this.senderVerifier.address,
          this.revealManager.address,
          this.omnuumWallet.address,
          this.mockVrfRequester.address,
        ],
        [
          ContractTopic.VRF,
          ContractTopic.MINTMANAGER,
          ContractTopic.EXCHANGE,
          ContractTopic.TICKET,
          ContractTopic.VERIFIER,
          ContractTopic.REVEAL,
          ContractTopic.WALLET,
          ContractTopic.TEST,
        ],
      )
    ).wait();

    await (await this.omnuumCAManager.addRole([this.omnuumVRFManager.address, this.mockExchange.address], contractRole.exchange)).wait();
    await (await this.omnuumCAManager.addRole([this.revealManager.address, this.mockVrfRequester.address], contractRole.vrf)).wait();

    /* Deploy NFT beacon proxy */
    this.omnuumNFT1155 = await (
      await module.exports.deployNFT(this.NFTbeacon, this.OmnuumNFT1155, this, {
        caManagerAddress: this.omnuumCAManager.address,
        ...overrides,
      })
    ).deployed();

    /* Deploy Mock NFT */
    this.mockNFT = await (await this.MockNFT.deploy(this.senderVerifier.address, this.ticketManager.address)).deployed();
  },
};
