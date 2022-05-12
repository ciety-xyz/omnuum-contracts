const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { go, mapC, map, range, pluck, add } = require('fxjs');

const { addDays } = require('date-fns');
const { deployNFT, prepareMockDeploy, prepareDeploy, testDeploy } = require('./etc/mock.js');
const { nullAddress, toSolDate } = require('./etc/util.js');
const Constants = require('../utils/constants.js');

const group_id = 1;
const end_date = toSolDate(addDays(new Date(), 2));

upgrades.silenceWarnings();

describe('OmnuumMintManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('Security', () => {
    it('[Revert] Should not initialize after deploy', async () => {
      const { omnuumMintManager, accounts } = this;

      await expect(omnuumMintManager.connect(accounts[0]).initialize(1, accounts[0].address)).to.be.revertedWith(
        Constants.reasons.common.initialize,
      );
    });
  });

  describe('[Method] getFeeRate', () => {
    it('Should get fee rate - basic rate', async () => {
      const { omnuumMintManager, omnuumNFT721 } = this;
      expect((await omnuumMintManager.getFeeRate(omnuumNFT721.address)).toNumber()).to.equal(Constants.testValues.feeRate);
    });
    it('Should get fee rate - special rate', async () => {
      const { omnuumMintManager, omnuumNFT721 } = this;
      const tx = await omnuumMintManager.setSpecialFeeRate(omnuumNFT721.address, Constants.testValues.specialFeeRate);
      await tx.wait();

      expect((await omnuumMintManager.getFeeRate(omnuumNFT721.address)).toNumber()).to.equal(Constants.testValues.specialFeeRate);
    });
  });

  describe('[Method] changeFeeRate', () => {
    it('Change Fee Rate', async () => {
      const { omnuumMintManager } = this;
      const newFee = 123;
      const tx = await omnuumMintManager.changeFeeRate(newFee);

      await tx.wait();

      await expect(tx).to.emit(omnuumMintManager, Constants.events.MintManager.ChangeFeeRate).withArgs(newFee);

      expect((await omnuumMintManager.feeRate()).toNumber()).to.equal(newFee);
    });
    it('[Revert] not owner', async () => {
      const {
        omnuumMintManager,
        accounts: [, notOwner],
      } = this;
      await expect(omnuumMintManager.connect(notOwner).changeFeeRate(0)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
    it('[Revert] Fee rate should be lower than 100%', async () => {
      const { omnuumMintManager } = this;
      const decimal = await omnuumMintManager.rateDecimal();
      await expect(omnuumMintManager.changeFeeRate(10 ** decimal + 1)).to.be.revertedWith(Constants.reasons.code.NE1);
    });
  });

  describe('[Method] setSpecialFeeRate', () => {
    it('Set special fee rate of nft contract', async () => {
      const { omnuumMintManager } = this;
      const nftContractAddr = this.omnuumNFT721.address;
      const tx = await omnuumMintManager.setSpecialFeeRate(nftContractAddr, Constants.testValues.specialFeeRate);
      await tx.wait();

      await expect(tx)
        .to.emit(omnuumMintManager, Constants.events.MintManager.SetSpecialFeeRate)
        .withArgs(nftContractAddr, Constants.testValues.specialFeeRate);

      expect(await omnuumMintManager.specialFeeRates(nftContractAddr)).to.equal(Constants.testValues.specialFeeRate);
    });
    it('[Revert] not owner', async () => {
      const { omnuumMintManager, accounts } = this;
      const nftContractAddr = this.omnuumNFT721.address;
      const notOwner = accounts[1];
      await expect(
        omnuumMintManager.connect(notOwner).setSpecialFeeRate(nftContractAddr, Constants.testValues.specialFeeRate),
      ).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
    it('[Revert] Special fee rate should be lower than 100%', async () => {
      const { omnuumMintManager } = this;
      const nftContractAddr = this.omnuumNFT721.address;
      const decimal = await omnuumMintManager.rateDecimal();
      await expect(omnuumMintManager.setSpecialFeeRate(nftContractAddr, 10 ** decimal + 1)).to.be.revertedWith(Constants.reasons.code.NE1);
    });
  });

  describe('[Method] setMinFee', () => {
    it('Should set min fee', async () => {
      const { omnuumMintManager } = this;

      const newMinFee = ethers.utils.parseEther('0.05');

      const tx = await omnuumMintManager.setMinFee(newMinFee);

      await tx.wait();

      await expect(tx).to.emit(omnuumMintManager, Constants.events.MintManager.SetMinFee).withArgs(newMinFee);

      expect(await omnuumMintManager.minFee()).to.equal(newMinFee);
    });
    it('[Revert] Only Owner can set', async () => {
      const { omnuumMintManager, accounts } = this;
      const not_owner = accounts[1];

      await expect(omnuumMintManager.connect(not_owner).setMinFee(100)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] setPublicMintSchedule', () => {
    it('Should set public mint schedule', async () => {
      const { omnuumNFT721, omnuumMintManager } = this;

      const base_price = ethers.utils.parseEther('0.2');

      const open_amount = 2000;
      const max_mint_per_address = 5;

      const tx = await omnuumMintManager.setPublicMintSchedule(
        omnuumNFT721.address,
        group_id,
        end_date,
        base_price,
        open_amount,
        max_mint_per_address,
      );

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumMintManager, Constants.events.MintManager.SetPublicSchedule)
        .withArgs(omnuumNFT721.address, group_id, end_date, base_price, open_amount, max_mint_per_address);
    });
    it('[Revert] only owner of collection', async () => {
      const {
        omnuumNFT721,
        omnuumMintManager,
        accounts: [, maliciousAC],
      } = this;

      const base_price = ethers.utils.parseEther('0.2');

      const open_amount = 2000;

      await expect(
        omnuumMintManager.connect(maliciousAC).setPublicMintSchedule(omnuumNFT721.address, group_id, end_date, base_price, open_amount, 5),
      ).to.be.revertedWith(Constants.reasons.code.OO1);
    });
  });

  describe('[Method] preparePublicMint', () => {
    it('Should public mint', async () => {
      const {
        omnuumMintManager,
        MockNFT,
        accounts: [, ownerAC],
      } = this;

      // use mock nft
      // constructor arguments are not related here
      const mockNFT = await MockNFT.connect(ownerAC).deploy(ownerAC.address, ownerAC.address);
      await mockNFT.deployed();

      const base_price = ethers.utils.parseEther('0.2');
      const open_amount = 2000;
      const quantity = 10;

      // set public mint schedule
      await (
        await omnuumMintManager.connect(ownerAC).setPublicMintSchedule(mockNFT.address, group_id, end_date, base_price, open_amount, 20)
      ).wait();

      const money = base_price.mul(quantity);

      // test through mock nft
      const tx = await mockNFT.connect(ownerAC).publicMint(omnuumMintManager.address, group_id, quantity, money, ownerAC.address);

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumMintManager, Constants.events.MintManager.PublicMint)
        .withArgs(mockNFT.address, ownerAC.address, group_id, quantity, open_amount, base_price);
    });
    it('[Revert] cannot mint after end date passed ', async () => {
      const {
        omnuumMintManager,
        MockNFT,
        accounts: [, ownerAC],
      } = this;

      // use mock nft
      // constructor arguments are not related here
      const mockNFT = await MockNFT.connect(ownerAC).deploy(ownerAC.address, ownerAC.address);
      await mockNFT.deployed();

      const base_price = ethers.utils.parseEther('0.2');
      const open_amount = 2000;
      const quantity = 10;
      const immediate_end_date = toSolDate(+new Date() + 3000);

      // set public mint schedule - immediately expired
      await (
        await omnuumMintManager
          .connect(ownerAC)
          .setPublicMintSchedule(mockNFT.address, group_id, immediate_end_date, base_price, open_amount, 20)
      ).wait();

      const money = base_price.mul(quantity);

      // test through mock nft
      await expect(
        mockNFT.connect(ownerAC).publicMint(omnuumMintManager.address, group_id, quantity, money, ownerAC.address),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    });
    it('[Revert] not enough money', async () => {
      const {
        omnuumMintManager,
        MockNFT,
        accounts: [, ownerAC],
      } = this;

      // use mock nft
      // constructor arguments are not related here
      const mockNFT = await MockNFT.connect(ownerAC).deploy(ownerAC.address, ownerAC.address);
      await mockNFT.deployed();

      const base_price = ethers.utils.parseEther('0.2');
      const open_amount = 2000;
      const quantity = 10;

      // set public mint schedule - immediately expired
      await (
        await omnuumMintManager.connect(ownerAC).setPublicMintSchedule(mockNFT.address, group_id, end_date, base_price, open_amount, 20)
      ).wait();

      const lacked_money = base_price.mul(quantity).div(2);

      // test through mock nft
      await expect(
        mockNFT.connect(ownerAC).publicMint(omnuumMintManager.address, group_id, quantity, lacked_money, ownerAC.address),
      ).to.be.revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] cannot mint more than max per address', async () => {
      const {
        omnuumMintManager,
        MockNFT,
        accounts: [, ownerAC],
      } = this;

      // use mock nft
      // constructor arguments are not related here
      const mockNFT = await MockNFT.connect(ownerAC).deploy(ownerAC.address, ownerAC.address);
      await mockNFT.deployed();

      const base_price = ethers.utils.parseEther('0.2');
      const open_amount = 2000;
      const quantity = 10;
      const max_per_address = 5;

      // set public mint schedule - immediately expired
      await (
        await omnuumMintManager
          .connect(ownerAC)
          .setPublicMintSchedule(mockNFT.address, group_id, end_date, base_price, open_amount, max_per_address)
      ).wait();

      const lacked_money = base_price.mul(quantity);

      // test through mock nft
      await expect(
        mockNFT.connect(ownerAC).publicMint(omnuumMintManager.address, group_id, quantity, lacked_money, ownerAC.address),
      ).to.be.revertedWith(Constants.reasons.code.MT2);
    });
    it('[Revert] cannot mint more than supply of public mint schedule', async () => {
      const {
        omnuumMintManager,
        MockNFT,
        accounts: [, ownerAC],
      } = this;

      // use mock nft
      // constructor arguments are not related here
      const mockNFT = await MockNFT.connect(ownerAC).deploy(ownerAC.address, ownerAC.address);
      await mockNFT.deployed();

      const base_price = ethers.utils.parseEther('0.2');
      const open_amount = 100;
      const success_quantity1 = 80;
      const success_quantity2 = 20;
      const fail_quantity1 = 120;
      const fail_quantity2 = 21;
      const max_per_address = 200;

      // set public mint schedule - immediately expired
      await (
        await omnuumMintManager
          .connect(ownerAC)
          .setPublicMintSchedule(mockNFT.address, group_id, end_date, base_price, open_amount, max_per_address)
      ).wait();

      // fail 1: 120 is over 100
      await expect(
        mockNFT
          .connect(ownerAC)
          .publicMint(omnuumMintManager.address, group_id, fail_quantity1, base_price.mul(fail_quantity1), ownerAC.address),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // success 1: 80 of 100
      await (
        await mockNFT
          .connect(ownerAC)
          .publicMint(omnuumMintManager.address, group_id, success_quantity1, base_price.mul(success_quantity1), ownerAC.address)
      ).wait();

      // fail 2: 21 is over 20
      await expect(
        mockNFT
          .connect(ownerAC)
          .publicMint(omnuumMintManager.address, group_id, fail_quantity2, base_price.mul(fail_quantity2), ownerAC.address),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // success 2: 20 of 20
      await (
        await mockNFT
          .connect(ownerAC)
          .publicMint(omnuumMintManager.address, group_id, success_quantity2, base_price.mul(success_quantity2), ownerAC.address)
      ).wait();
    });
  });

  describe('[Method] mintMultiple', () => {
    it('Airdrop to multiple address', async () => {
      const { omnuumMintManager, omnuumNFT721, accounts } = this;
      const count = 5;
      const airDropToAddresses = pluck('address', accounts.slice(1, count + 1));

      const tx = await omnuumMintManager.connect(accounts[0]).mintMultiple(
        omnuumNFT721.address,
        airDropToAddresses,
        go(
          range(count),
          map(() => 1),
        ),
        {
          value: Constants.testValues.minFee.mul(count),
        },
      );

      await tx.wait();

      // Note: token id is started from 1, not zero.
      await go(
        range(count),
        // event TransferSingle (address operator, address from, address to, uint256 id, uint256 value)
        mapC(async (idx) =>
          expect(tx)
            .to.emit(omnuumNFT721, Constants.events.NFT.TransferSingle)
            .withArgs(omnuumMintManager.address, nullAddress, airDropToAddresses[idx], idx + 1, 1),
        ),
      );
      await go(
        range(count),
        // event Airdrop(address indexed Contract, address indexed receiver, uint256 quantity)
        mapC(async (idx) =>
          expect(tx)
            .to.emit(omnuumMintManager, Constants.events.MintManager.Airdrop)
            .withArgs(omnuumNFT721.address, airDropToAddresses[idx], 1),
        ),
      );
    });
    it('[Revert] not owner', async () => {
      const { omnuumMintManager, omnuumNFT721, accounts } = this;
      const count = 5;

      await expect(
        omnuumMintManager.connect(accounts[1]).mintMultiple(
          omnuumNFT721.address,
          pluck('address', accounts.slice(1, count + 1)),
          go(
            range(count),
            map(() => 1),
          ),
        ),
      ).to.be.revertedWith(Constants.reasons.code.OO1);
    });
    it('[Revert] arg length not equal', async () => {
      const { omnuumMintManager, omnuumNFT721, accounts } = this;
      const count = 5;

      await expect(
        omnuumMintManager.connect(accounts[0]).mintMultiple(
          omnuumNFT721.address,
          pluck('address', accounts.slice(1, count + 1)),
          go(
            // quantity array length is lower than address count on purpose
            range(count - 1),
            map(() => 1),
          ),
        ),
      ).to.be.revertedWith(Constants.reasons.code.ARG1);
    });
    it('[Revert] NFT remaining quantity is less than requested', async () => {
      const { omnuumMintManager, accounts } = this;

      const omnuumNFT721 = await deployNFT(this, {
        maxSupply: 10,
      });

      await expect(
        omnuumMintManager.connect(accounts[0]).mintMultiple(omnuumNFT721.address, [accounts[1].address], [12], {
          value: ethers.utils.parseEther('1'), // enough ether for mint fee
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
    it('[Revert] Should pay minimum fee * quantity', async () => {
      const { omnuumNFT721, omnuumMintManager, accounts } = this;

      const quantitys = [2, 3, 4];
      const total_quantity = quantitys.reduce(add);

      await expect(
        omnuumMintManager
          .connect(accounts[0])
          .mintMultiple(omnuumNFT721.address, [accounts[1].address, accounts[2].address, accounts[3].address], quantitys, {
            value: Constants.testValues.minFee.mul(total_quantity - 1), // pay less money
          }),
      ).to.be.revertedWith(Constants.reasons.code.ARG3);
    });
  });
});
