const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { go, mapC, map, range, pluck } = require('fxjs');

const { deployNFT, prepareDeploy, testDeploy } = require('./etc/mock.js');
const { nullAddress } = require('./etc/util.js');
const { reasons, events } = require('../utils/constants.js');

upgrades.silenceWarnings();

describe('OmnuumMintManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('Security', () => {
    it('[Revert] Should not initialize after deploy', async () => {
      const { omnuumMintManager, accounts } = this;

      await expect(omnuumMintManager.connect(accounts[0]).initialize(1)).to.be.revertedWith(
        reasons.common.initialize,
      );
    });
  });

  describe('[Method] setFeeRate', () => {
    it('Get fee', async () => {
      const { omnuumMintManager } = this;

      const fee_rate = await omnuumMintManager.feeRate();

      expect(fee_rate).equal(2500);
    });

    it('Set fee', async () => {
      const { omnuumMintManager, accounts } = this;

      const tx = await omnuumMintManager.connect(accounts[0]).setFeeRate(3000);

      await tx.wait();

      await expect(tx).to.emit(omnuumMintManager, events.MintManager.SetFee).withArgs(3000);
      expect(await omnuumMintManager.feeRate()).to.equal(3000);
    });

    it('[Revert] not owner', async () => {
      const { omnuumMintManager, accounts } = this;

      const tx = omnuumMintManager.connect(accounts[1]).setFeeRate(3000);

      await expect(tx).to.be.reverted;
    });

    it('[Revert] Fee rate should be lower than 100%', async () => {
      // rate deicimal is 5, so 100000 == 100%
      const { omnuumMintManager, accounts } = this;

      const tx = omnuumMintManager.connect(accounts[0]).setFeeRate(100001);

      await expect(tx).to.be.revertedWith(reasons.code.NE1);
    });
  });

  describe('[method] mintMultiple', () => {
    it('Airdrop to multiple address', async () => {
      const { omnuumMintManager, omnuumNFT1155, accounts } = this;
      const count = 5;

      const tx = await omnuumMintManager.connect(accounts[0]).mintMultiple(
        omnuumNFT1155.address,
        pluck('address', accounts.slice(1, count + 1)),
        go(
          range(count),
          map(() => 1),
        ),
      );

      await tx.wait();

      // TransferSingle (address operator, address from, address to, uint256 id, uint256 value)
      await mapC(
        (idx) =>
          expect(tx)
            .to.emit(omnuumNFT1155, events.NFT.TransferSingle)
            .withArgs(omnuumMintManager.address, nullAddress, accounts[idx].address, idx, 1),
        range(1, count + 1),
      );

      await expect(tx)
        .to.emit(omnuumMintManager, events.MintManager.Airdrop)
        .withArgs(omnuumNFT1155.address, 5);
    });

    it('[Revert] not owner', async () => {
      const { omnuumMintManager, omnuumNFT1155, accounts } = this;
      const count = 5;

      await expect(
        omnuumMintManager.connect(accounts[1]).mintMultiple(
          omnuumNFT1155.address,
          pluck('address', accounts.slice(1, count + 1)),
          go(
            range(count),
            map(() => 1),
          ),
        ),
      ).to.be.revertedWith(reasons.code.OO1);
    });

    it('[Revert] arg length not equal', async () => {
      const { omnuumMintManager, omnuumNFT1155, accounts } = this;
      const count = 5;

      await expect(
        omnuumMintManager.connect(accounts[0]).mintMultiple(
          omnuumNFT1155.address,
          pluck('address', accounts.slice(1, count + 1)),
          go(
            // quantity array length is lower than address count on purpose
            range(count - 1),
            map(() => 1),
          ),
        ),
      ).to.be.revertedWith(reasons.code.ARG1);
    });

    it('[Revert] NFT remaining quantity is less than requested', async () => {
      const { omnuumMintManager, accounts } = this;

      const omnuumNFT1155 = await deployNFT(this.NFTbeacon, this.OmnuumNFT1155, this, {
        caManagerAddress: this.omnuumCAManager.address,
        maxSupply: 10,
      });

      await expect(
        omnuumMintManager
          .connect(accounts[0])
          .mintMultiple(omnuumNFT1155.address, [accounts[1].address], [12]),
      ).to.be.revertedWith(reasons.code.MT3);
    });
  });
});
