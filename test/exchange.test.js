const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const Constants = require('../utils/constants.js');
require('chai').should();

Error.stackTraceLimit = Infinity;

const { prepareDeploy, prepareMockDeploy, testDeploy } = require('./etc/mock.js');
const { nullAddress, isLocalNetwork } = require('./etc/util.js');

upgrades.silenceWarnings();

describe('OmnuumExchange', () => {
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
      const { omnuumExchange, accounts } = this;

      await expect(omnuumExchange.connect(accounts[1]).initialize(accounts[1].address)).to.be.revertedWith(
        Constants.reasons.common.initialize,
      );
    });
  });

  describe('[Method] getExchangeAmount', () => {
    it('Get Exchange Amount for token', async () => {
      const { omnuumExchange } = this;
      const amount = ethers.utils.parseEther('2');
      const exchangeAmount = await omnuumExchange.getExchangeAmount(nullAddress, Constants.chainlink.rinkeby.LINK, amount);
      const tmpLinkExRate = await omnuumExchange.tmpLinkExRate();

      expect(exchangeAmount).to.be.equal(tmpLinkExRate.mul(amount).div(ethers.utils.parseEther('1')));
    });
  });

  describe('[Method] updateTmpExchangeRate', () => {
    it('should update exchangeRate', async () => {
      const { omnuumExchange } = this;
      const new_rate = ethers.utils.parseEther('0.1');

      const tx = await omnuumExchange.updateTmpExchangeRate(new_rate);
      await tx.wait();

      expect(await omnuumExchange.tmpLinkExRate()).to.be.equal(new_rate);
    });
    it('[Revert] Only omnuum can update rate', async () => {
      const { omnuumExchange, accounts } = this;

      const rate = ethers.utils.parseEther('0.1');

      await expect(omnuumExchange.connect(accounts[1]).updateTmpExchangeRate(rate)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] exchangeToken', () => {
    // !! Only work for rinkeby or mainnet, in local, LINK token contract is required
    it('Receive token from exchange (rinkeby)', async () => {
      if (await isLocalNetwork(ethers.provider)) return;
      const { omnuumExchange, accounts } = this;
      const amount = 2;
      const tx = await omnuumExchange.exchangeToken(Constants.chainlink.rinkeby.LINK, amount, accounts[1].address);

      await tx.wait();

      expect(tx)
        .to.emit(omnuumExchange, 'Exchange')
        .withArgs(nullAddress, Constants.chainlink.rinkeby.LINK, amount, accounts[0].address, accounts[1].address);
    });
    it('Receive token from exchange (local mock)', async () => {
      if (!(await isLocalNetwork(ethers.provider))) return;
      const { omnuumExchange, mockExchange, accounts, mockLink } = this;
      const amount = 2;

      const tx = await mockExchange.exchangeToken(omnuumExchange.address, mockLink.address, amount, accounts[1].address);

      await tx.wait();

      expect(tx)
        .to.emit(omnuumExchange, 'Exchange')
        .withArgs(nullAddress, mockLink.address, amount, mockExchange.address, accounts[1].address);
    });
    it('[Revert] Check sender has EXCHANGE role', async () => {
      const {
        omnuumExchange,
        accounts: [, not_omnuum_eoa],
      } = this;
      const amount = 2;

      await expect(
        omnuumExchange.connect(not_omnuum_eoa).exchangeToken(Constants.chainlink.rinkeby.LINK, amount, not_omnuum_eoa.address),
      ).to.be.revertedWith(Constants.reasons.code.OO7);
    });
  });

  describe('[Method] withdraw', () => {
    it('Withdraw successfully', async () => {
      const {
        omnuumExchange,
        mockExchange,
        mockLink,
        omnuumWallet,
        accounts: [depositer],
      } = this;

      const value = ethers.utils.parseEther('5');
      const test_link_move_amount = ethers.utils.parseEther('1');

      // mock proxy request through mockExchange -> omnuumExchange
      // depositer send 5 ether to exchange contract
      const deposit_tx = await mockExchange.exchangeToken(
        omnuumExchange.address,
        mockLink.address,
        test_link_move_amount,
        depositer.address,
        {
          value,
        },
      );

      await deposit_tx.wait();

      const exchange_balance = await ethers.provider.getBalance(omnuumExchange.address);
      const wallet_prev_bal = await ethers.provider.getBalance(omnuumWallet.address);

      await (await omnuumExchange.withdraw(exchange_balance)).wait();

      const wallet_cur_bal = await ethers.provider.getBalance(omnuumWallet.address);

      expect(wallet_cur_bal).to.equal(wallet_prev_bal.add(value));
    });
    it('[Revert] Only omnuum can withdraw', async () => {
      const { omnuumExchange, accounts } = this;

      await expect(omnuumExchange.connect(accounts[1]).withdraw(1)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
    it('[Revert] Withdraw more than contract\'s balance', async () => {
      const {
        omnuumExchange,
        mockExchange,
        mockLink,
        accounts: [depositer],
      } = this;

      const value = ethers.utils.parseEther('5');
      const test_link_move_amount = ethers.utils.parseEther('1');

      // mock proxy request through mockExchange -> omnuumExchange
      // depositer send 5 ether to exchange contract
      const deposit_tx = await mockExchange.exchangeToken(
        omnuumExchange.address,
        mockLink.address,
        test_link_move_amount,
        depositer.address,
        {
          value,
        },
      );

      await deposit_tx.wait();

      const exchange_balance = await ethers.provider.getBalance(omnuumExchange.address);

      await expect(omnuumExchange.withdraw(exchange_balance.add(1))).to.be.revertedWith(Constants.reasons.code.ARG2);
    });
  });
});
