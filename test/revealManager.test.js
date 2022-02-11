const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { flatMap, mapC, go, range, map } = require('fxjs');
const { addDays } = require('date-fns');

const { toSolDate, isLocalNetwork } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, testDeploy, deployNFT } = require('./etc/mock.js');

const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

// *Ticket Manager Contract will be removed and this feature will be replaced by off-chain lazy minting method.
describe('RevealManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] vrfRequest', () => {
    it('Request VRF for NFT project', async () => {
      const { omnuumNFT1155, revealManager } = this;

      if (await isLocalNetwork(ethers.provider)) return;

      // check link is enough
      await revealManager.vrfRequest(omnuumNFT1155.address);
    });
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

  describe('[Method] vrfResponse', () => {
    it('Should emit reveal event with random number', async () => {});
    it('[Revert] only vrf contract can call', async () => {
      const {
        accounts: [omnuumAC, minterAC, maliciousAC, prjOwnerAC],
        omnuumTicketManager,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      await expect(
        omnuumTicketManager
          .connect(maliciousAC)
          .giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [3], [basePrice], group_id, end_date),
      ).to.be.revertedWith(Constants.reasons.code.OO1);

      // even ticket manager owner cannot access this
      await expect(
        omnuumTicketManager
          .connect(omnuumAC)
          .giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [3], [basePrice], group_id, end_date),
      ).to.be.revertedWith(Constants.reasons.code.OO1);
    });
  });
});
