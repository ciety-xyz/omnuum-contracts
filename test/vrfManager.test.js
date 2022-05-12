const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { parseEvent, isLocalNetwork, nullAddress } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, prepareMockDeploy, testDeploy } = require('./etc/mock.js');

upgrades.silenceWarnings();

// *Ticket Manager Contract will be removed and this feature will be replaced by off-chain lazy minting method.
describe('OmnuumVRFManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] requestVRF', () => {
    it('Should request VRF and receive response (local mock)', async () => {
      const { omnuumVRFManager, mockVrfCoords, mockVrfRequester, omnuumExchange } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      const requestTx = await mockVrfRequester.requestVRF(omnuumVRFManager.address);

      const vrfIface = omnuumVRFManager.interface;
      const exchangeIface = omnuumExchange.interface;

      const [, requestEvent] = parseEvent([exchangeIface, vrfIface], await requestTx.wait());
      const {
        args: { requestId, roller },
      } = requestEvent;

      await expect(requestTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.RequestVRF)
        .withArgs(mockVrfRequester.address, requestEvent.args.requestId, Constants.vrfTopic.REVEAL_PFP);

      expect(roller).to.be.equal(mockVrfRequester.address);

      const randomNumber = Math.floor(Math.random() * 100000);

      // mimic VRF action - send random number to contract
      const responseTx = await mockVrfCoords.sendRandom(omnuumVRFManager.address, requestId, randomNumber);

      await responseTx.wait();

      // call to EOA is always success
      await expect(responseTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.ResponseVRF)
        .withArgs(requestId, randomNumber, Constants.vrfTopic.REVEAL_PFP, false, 'Transaction reverted silently');
    });
    it('Should request VRF and receive response (rinkeby)', async () => {
      // TODO: rinkeby test
    });
    it('[Revert] When link is not enough on exchange contract (logic mock)', async () => {
      const { omnuumVRFManager, mockLink, mockVrfRequester } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      // change link balance -> 0.05 LINK, VRF requires 0.1 LINK
      await mockLink.changeBalance(ethers.utils.parseEther('0.05'));

      await expect(mockVrfRequester.requestVRF(omnuumVRFManager.address)).to.be.revertedWith(Constants.reasons.code.SE7);
    });
    it('[Revert] Not Omnuum or do not have role', async () => {
      const {
        omnuumVRFManager,
        accounts: [, maliciousAC],
      } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      await expect(omnuumVRFManager.connect(maliciousAC).requestVRF(Constants.vrfTopic.REVEAL_PFP)).to.be.revertedWith(
        Constants.reasons.code.OO7,
      );
    });
  });

  describe('[Method] requestVRFOnce', () => {
    it('Should request VRF and receive response (local mock)', async () => {
      const { omnuumVRFManager, mockVrfCoords, omnuumExchange, revealManager, mockLink, omnuumNFT721 } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      const vrfFee = Constants.chainlink.rinkeby.fee;
      const exchangeAmount = await omnuumExchange.getExchangeAmount(nullAddress, mockLink.address, vrfFee);
      const safetyRatio = await omnuumVRFManager.safetyRatio();

      // omnuumAC == omnuumNFT721.owner()
      // request vrf (tx => reveal manager => VRF manager)
      const requestTx = await revealManager.vrfRequest(omnuumNFT721.address, { value: exchangeAmount.mul(safetyRatio).div(100) });

      const vrfIface = omnuumVRFManager.interface;
      const exchangeIface = omnuumExchange.interface;

      const [, requestEvent] = parseEvent([exchangeIface, vrfIface], await requestTx.wait());
      const {
        args: { requestId },
      } = requestEvent;

      await expect(requestTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.RequestVRF)
        .withArgs(omnuumNFT721.address, requestEvent.args.requestId, Constants.vrfTopic.REVEAL_PFP);

      const randomNumber = Math.floor(Math.random() * 100000);

      // mimic VRF action - send random number to contract
      const responseTx = await mockVrfCoords.sendRandom(omnuumVRFManager.address, requestId, randomNumber);

      await responseTx.wait();

      // result will false because revealManager does not implement vrfResponse method
      await expect(responseTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.ResponseVRF)
        .withArgs(requestId, randomNumber, Constants.vrfTopic.REVEAL_PFP, false, Constants.reasons.RevertMessage.silent);
    });
    it('Should request VRF and receive response (rinkeby)', async () => {
      // TODO: rinkeby test
    });
    it('[Revert] only omnuum - reveal manager', async () => {
      const {
        omnuumVRFManager,
        accounts: [, not_omnuumAC, anyAC],
      } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      await expect(omnuumVRFManager.connect(not_omnuumAC).requestVRFOnce(anyAC.address, Constants.vrfTopic.REVEAL_PFP)).to.be.revertedWith(
        Constants.reasons.code.OO7,
      );
    });
    it('[Revert] When link is not enough on exchange contract (local mock)', async () => {
      const {
        omnuumVRFManager,
        mockVrfRequester,
        mockLink,
        accounts: [anyAC],
      } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      // change link balance -> 0.05 LINK, VRF requires 0.1 LINK
      await mockLink.changeBalance(ethers.utils.parseEther('0.05'));

      await expect(mockVrfRequester.requestVRFOnce(omnuumVRFManager.address, anyAC.address)).to.be.revertedWith(Constants.reasons.code.SE7);
    });
    it('[Revert] not enough ether for LINK fee (local mock)', async () => {
      const {
        omnuumVRFManager,
        mockVrfRequester,
        omnuumExchange,
        mockLink,
        accounts: [anyAC],
      } = this;

      if (!(await isLocalNetwork(ethers.provider))) return;

      const vrfFee = Constants.chainlink.rinkeby.fee;
      const exchangeAmount = await omnuumExchange.getExchangeAmount(nullAddress, mockLink.address, vrfFee);
      const safetyRatio = await omnuumVRFManager.safetyRatio();
      const lackAmount = ethers.utils.parseEther('0.00001');

      await expect(
        mockVrfRequester.requestVRFOnce(omnuumVRFManager.address, anyAC.address, {
          value: exchangeAmount.mul(safetyRatio).div(100).sub(lackAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.ARG3);
    });
    it('[Revert] Already used address', async () => {
      const { omnuumVRFManager, mockVrfCoords, omnuumExchange, revealManager, mockLink, omnuumNFT721 } = this;
      const vrfFee = Constants.chainlink.rinkeby.fee;
      const exchangeAmount = await omnuumExchange.getExchangeAmount(nullAddress, mockLink.address, vrfFee);
      const safetyRatio = await omnuumVRFManager.safetyRatio();

      // success for first time
      const requestTx = await revealManager.vrfRequest(omnuumNFT721.address, { value: exchangeAmount.mul(safetyRatio).div(100) });

      const vrfIface = omnuumVRFManager.interface;
      const exchangeIface = omnuumExchange.interface;

      const [, requestEvent] = parseEvent([exchangeIface, vrfIface], await requestTx.wait());
      const {
        args: { requestId },
      } = requestEvent;

      await expect(requestTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.RequestVRF)
        .withArgs(omnuumNFT721.address, requestEvent.args.requestId, Constants.vrfTopic.REVEAL_PFP);

      const randomNumber = Math.floor(Math.random() * 100000);

      const responseTx = await mockVrfCoords.sendRandom(omnuumVRFManager.address, requestId, randomNumber);

      await responseTx.wait();

      await expect(responseTx)
        .to.emit(omnuumVRFManager, Constants.events.VRFManager.ResponseVRF)
        .withArgs(requestId, randomNumber, Constants.vrfTopic.REVEAL_PFP, false, Constants.reasons.RevertMessage.silent);

      // fail for second try
      await expect(revealManager.vrfRequest(omnuumNFT721.address, { value: exchangeAmount.mul(safetyRatio).div(100) })).to.be.revertedWith(
        Constants.reasons.code.SE8,
      );
    });
  });

  describe('[Method] updateFee', () => {
    it('Should update fee', async () => {
      const { omnuumVRFManager } = this;

      const fee = ethers.utils.parseEther('2.5');

      const tx = await omnuumVRFManager.updateFee(fee);
      const topic = 'vrfFee';

      await tx.wait();

      await expect(tx).to.emit(omnuumVRFManager, Constants.events.VRFManager.Updated).withArgs(fee, topic);
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumVRFManager,
        accounts: [, maliciousAC],
      } = this;

      const fee = ethers.utils.parseEther('2.5');

      await expect(omnuumVRFManager.connect(maliciousAC).updateFee(fee)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] updateSafetyRatio', () => {
    it('Should update safety ratio', async () => {
      const { omnuumVRFManager } = this;

      const ratio = 120;

      const tx = await omnuumVRFManager.updateSafetyRatio(ratio);
      const action_type = 'safetyRatio';

      await tx.wait();

      await expect(tx).to.emit(omnuumVRFManager, Constants.events.VRFManager.Updated).withArgs(ratio, action_type);
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumVRFManager,
        accounts: [, maliciousAC],
      } = this;

      const ratio = 120;

      await expect(omnuumVRFManager.connect(maliciousAC).updateSafetyRatio(ratio)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });
});
