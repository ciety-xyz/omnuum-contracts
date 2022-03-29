const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { signPayload } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, prepareMockDeploy, testDeploy } = require('./etc/mock.js');

const group_id = 0;

upgrades.silenceWarnings();

describe('SenderVerifier', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] verify', () => {
    it('Verify signed by omnuum', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
      } = this;

      const payload = await signPayload(
        minterAC.address, // sender
        Constants.payloadTopic.ticket, // topic
        group_id, // nonce
        omnuumAC, // signer
        senderVerifier.address, // verify contract address
      );

      const verify_result = await senderVerifier.verify(
        omnuumAC.address, // signer
        minterAC.address, // sender
        Constants.payloadTopic.ticket, // topic
        group_id, // nonce
        payload,
      );

      expect(verify_result).to.be.deep.equal([]);
    });
    it('[Revert] False topic', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
      } = this;

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        senderVerifier.verify(
          omnuumAC.address,
          minterAC.address,
          Constants.payloadTopic.mint, // topic - false
          group_id,
          payload,
        ),
      ).to.be.revertedWith(Constants.reasons.code.VR3);
    });
    it('[Revert] False Signer', async () => {
      const {
        accounts: [omnuumAC, minterAC, falseSignerAC],
        senderVerifier,
      } = this;

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, falseSignerAC, senderVerifier.address);

      await expect(
        senderVerifier.verify(
          omnuumAC.address,
          minterAC.address,
          Constants.payloadTopic.ticket, // topic - false
          group_id,
          payload,
        ),
      ).to.be.revertedWith(Constants.reasons.code.VR1);
    });
    it('[Revert] False Nonce', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
      } = this;

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        senderVerifier.verify(
          omnuumAC.address,
          minterAC.address,
          Constants.payloadTopic.ticket,
          group_id + 1, // nonce - false
          payload,
        ),
      ).to.be.revertedWith(Constants.reasons.code.VR2);
    });
    it('[Revert] False Sender', async () => {
      const {
        accounts: [omnuumAC, minterAC, falseSenderAC],
        senderVerifier,
      } = this;

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        senderVerifier.verify(omnuumAC.address, falseSenderAC.address, Constants.payloadTopic.ticket, group_id, payload),
      ).to.be.revertedWith(Constants.reasons.code.VR4);
    });
  });
});
