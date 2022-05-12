const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { uniq, go, range, map, delay, last } = require('fxjs');
const { addDays } = require('date-fns');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, testDeploy, deployNFT, prepareMockDeploy } = require('./etc/mock.js');
const { signPayload, nullAddress, toSolDate, createTicket } = require('./etc/util.js');

const nonce = 1;
const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

describe('NftFactory', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] deploy', () => {
    it('Should deploy NFT contract', async () => {
      const {
        accounts: [, prjOwnerAC],
        senderVerifier,
        signatureSigner,
        nftFactory,
      } = this;

      const maxSupply = 100;
      const collectionId = 12;

      const tx = await nftFactory
        .connect(prjOwnerAC)
        .deploy(
          maxSupply,
          Constants.testValues.coverUri,
          collectionId,
          await signPayload(prjOwnerAC.address, Constants.payloadTopic.deployCol, collectionId, signatureSigner, senderVerifier.address),
        );

      const receipt = await tx.wait();

      const { args: deployEvent } = nftFactory.interface.parseLog(last(receipt.logs));

      expect(deployEvent.creator).to.be.equal(prjOwnerAC.address);
      expect(deployEvent.collectionId).to.be.equal(collectionId);
    });

    it('Should deploy multiple collection and addresses should be unique', async () => {
      const {
        accounts: [, prjOwnerAC],
        senderVerifier,
        ticketManager,
        signatureSigner,
        nftFactory,
      } = this;

      const maxSupply = 100;
      const collectionCount = 100;

      await go(
        range(collectionCount),
        map(async (collectionId) => {
          const tx = await nftFactory
            .connect(prjOwnerAC)
            .deploy(
              maxSupply,
              Constants.testValues.coverUri,
              collectionId,
              await signPayload(
                prjOwnerAC.address,
                Constants.payloadTopic.deployCol,
                collectionId,
                signatureSigner,
                senderVerifier.address,
              ),
            );

          const receipt = await tx.wait();

          const { args: deployEvent } = nftFactory.interface.parseLog(last(receipt.logs));

          expect(deployEvent.creator).to.be.equal(prjOwnerAC.address);
          expect(deployEvent.collectionId).to.be.equal(collectionId);

          return deployEvent.nftContract;
        }),
        uniq,
        (addresses) => expect(addresses.length).to.be.equal(collectionCount),
      );
    }).timeout(1000 * 60);

    it('[Revert] false signature', async () => {
      const {
        accounts: [falseSigner, prjOwnerAC],
        senderVerifier,
        ticketManager,
        signatureSigner,
        nftFactory,
      } = this;

      const maxSupply = 100;
      const collectionId = 12;

      // 1. false signer
      await expect(
        nftFactory
          .connect(prjOwnerAC)
          .deploy(
            maxSupply,
            Constants.testValues.coverUri,
            collectionId,
            await signPayload(prjOwnerAC.address, Constants.payloadTopic.deployCol, collectionId, falseSigner, senderVerifier.address),
          ),
      ).to.be.revertedWith(Constants.reasons.code.VR1);

      // 2. false nonce
      await expect(
        nftFactory.connect(prjOwnerAC).deploy(
          maxSupply,
          Constants.testValues.coverUri,
          collectionId,
          // payload collection id is not equal to above argument
          await signPayload(
            prjOwnerAC.address,
            Constants.payloadTopic.deployCol,
            collectionId + 1,
            signatureSigner,
            senderVerifier.address,
          ),
        ),
      ).to.be.revertedWith(Constants.reasons.code.VR2);

      // 3. false topic
      await expect(
        nftFactory
          .connect(prjOwnerAC)
          .deploy(
            maxSupply,
            Constants.testValues.coverUri,
            collectionId,
            await signPayload(prjOwnerAC.address, Constants.payloadTopic.mint, collectionId, signatureSigner, senderVerifier.address),
          ),
      ).to.be.revertedWith(Constants.reasons.code.VR3);
    });
  });
  describe('[Method] changeOmnuumSigner', () => {
    it('Should change signer', async () => {
      const {
        accounts: [, changedSigner],
        nftFactory,
      } = this;

      const prevSigner = await nftFactory.omnuumSigner();

      const tx = await nftFactory.changeOmnuumSigner(changedSigner.address);

      await tx.wait();

      const currentSigner = await nftFactory.omnuumSigner();

      expect(prevSigner).not.to.be.equal(currentSigner);
      expect(currentSigner).to.be.equal(changedSigner.address);
    });

    it('[Revert] Only owner', async () => {
      const {
        accounts: [, notOwnerAC],
        nftFactory,
      } = this;

      await expect(nftFactory.connect(notOwnerAC).changeOmnuumSigner(notOwnerAC.address)).to.be.revertedWith(
        Constants.reasons.common.onlyOwner,
      );
    });

    it('[Revert] Cannot set null address', async () => {
      const { nftFactory } = this;

      await expect(nftFactory.changeOmnuumSigner(nullAddress)).to.be.revertedWith(Constants.reasons.code.AE1);
    });
  });
});
