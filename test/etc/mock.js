const { ethers, upgrades } = require('hardhat');
const { mapC, go, zip, map } = require('fxjs');
const { ContractTopic, chainlink, testValues, contractRole } = require('../../utils/constants.js');
const { deployNFT } = require('../../scripts/deployments/deployments');

Error.stackTraceLimit = Infinity;

module.exports = {
  createNftContractArgs: (context, { prjOwner, signatureSignerPrivateKey, maxSupply = 10000 } = {}) => ({
    prjOwnerSigner: prjOwner || context?.accounts?.[0],
    // Since you cannot receive a response by requesting the private key from the provider, just hard-code it.
    signatureSignerPrivateKey: signatureSignerPrivateKey || 'f214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897', // hardhat account[10]
    senderVerifierAddress: context.senderVerifier.address,
    maxSupply,
    coverUri: testValues.coverUri,
    nftFactoryAddress: context.nftFactory.address,
    collectionId: testValues.collectionId,
  }),
  async deployNFT(context, overrideArgs) {
    const args = module.exports.createNftContractArgs(context, overrideArgs);

    const { beaconProxyAddress } = await deployNFT({
      projectOwnerSigner: args.prjOwnerSigner,
      signerPrivateKey: args.signatureSignerPrivateKey,
      senderVerifierAddress: args.senderVerifierAddress,
      maxSupply: args.maxSupply,
      coverUri: args.coverUri,
      nftFactoryAddress: args.nftFactoryAddress,
      collectionId: args.collectionId,
    });

    return context.OmnuumNFT1155.attach(beaconProxyAddress);
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
    this.NftFactory = await ethers.getContractFactory('NftFactory');

    /* Hardhat Accounts
     * Account #10: 0xbcd4042de499d14e55001ccbb24a551f3b954096 (10000 ETH)
     * Private Key: 0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897
     * */
    // eslint-disable-next-line prefer-destructuring
    this.signatureSigner = (await ethers.getSigners())[10];
  },
  async prepareMockDeploy() {
    this.MockLink = await ethers.getContractFactory('MockLink');
    this.MockVrfCoords = await ethers.getContractFactory('MockVrfCoords');
    this.MockNFT = await ethers.getContractFactory('MockNFT');
    this.MockExchange = await ethers.getContractFactory('MockExchange');
    this.MockVrfRequester = await ethers.getContractFactory('MockVrfRequester');
  },
  async testDeploy(accounts, overrides = []) {
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

    this.omnuumWallet = await this.OmnuumWallet.deploy(
      testValues.consensusRatio,
      testValues.minLimitForConsensus,
      this.walletOwnerAccounts,
    );
    this.revealManager = await this.RevealManager.deploy(this.omnuumCAManager.address);

    this.nftFactory = await this.NftFactory.deploy(this.omnuumCAManager.address, this.NFTbeacon.address, this.signatureSigner.address);

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
          this.nftFactory.address,
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
          ContractTopic.NFTFACTORY,
        ],
      )
    ).wait();

    await (await this.omnuumCAManager.addRole([this.omnuumVRFManager.address, this.mockExchange.address], contractRole.exchange)).wait();
    await (await this.omnuumCAManager.addRole([this.revealManager.address, this.mockVrfRequester.address], contractRole.vrf)).wait();

    /* Deploy NFT beacon proxy */
    this.omnuumNFT1155 = await module.exports.deployNFT(this, ...overrides);

    /* Deploy Mock NFT */
    this.mockNFT = await (await this.MockNFT.deploy(this.senderVerifier.address, this.ticketManager.address)).deployed();
  },
};
