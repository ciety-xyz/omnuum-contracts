const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { isLocalNetwork } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { testDeploy, prepareDeploy, prepareMockDeploy } = require('./etc/mock.js');

upgrades.silenceWarnings();

// *Ticket Manager Contract will be removed and this feature will be replaced by off-chain lazy minting method.
describe('RevealManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] vrfRequest', () => {
    // success case is tested on vRFManager.test.js
    it('[Revert] only project owner', async () => {
      const {
        omnuumNFT1155,
        revealManager,
        accounts: [, maliciousAC],
      } = this;

      if (await isLocalNetwork(ethers.provider)) return;

      // check link is enough
      await expect(revealManager.connect(maliciousAC).vrfRequest(omnuumNFT1155.address)).to.be.revertedWith(Constants.reasons.code.OO1);
    });
    it('[Revert] Already revealed project', async () => {
      const { omnuumNFT1155, revealManager } = this;

      // set isRevealed to true
      await (await omnuumNFT1155.setUri('mock.uri')).wait();

      await expect(revealManager.vrfRequest(omnuumNFT1155.address)).to.be.revertedWith(Constants.reasons.code.ARG2);
    });
  });
});
