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

      expect(exchangeAmount).to.be.equal(Constants.testValues.tmpExchangeRate.mul(amount).div(ethers.utils.parseEther('1')));
    });
  });
  describe('[Method] exchangeToken', () => {
    // !! Only work for rinkeby or mainnet, in local, LINK token contract is required
    it('Receive token from exchange', async () => {
      if (await isLocalNetwork(ethers.provider)) return;
      const { omnuumExchange, accounts } = this;
      const amount = 2;
      const tx = await omnuumExchange.exchangeToken(Constants.chainlink.rinkeby.LINK, amount, accounts[1].address);

      await tx.wait();

      expect(tx)
        .to.emit(omnuumExchange, 'Exchange')
        .withArgs(nullAddress, Constants.chainlink.rinkeby.LINK, amount, accounts[0].address, accounts[1].address);
    });

    it('[Revert] check sender is omnuum registered contract or address', async () => {
      const {
        omnuumExchange,
        accounts: [, not_omnuum],
      } = this;
      const amount = 2;

      expect(
        omnuumExchange.connect(not_omnuum).exchangeToken(Constants.chainlink.rinkeby.LINK, amount, not_omnuum.address),
      ).to.be.revertedWith(Constants.reasons.code.OO3);
    });
  });
  describe('[Method] updateTmpExchangeRate', () => {
    it('should update exchangeRate', async () => {
      const { omnuumExchange } = this;

      const uintAmount = ethers.utils.parseEther('1');

      const prev_rate = await omnuumExchange.getExchangeAmount(nullAddress, Constants.chainlink.rinkeby.LINK, uintAmount);

      const rate = ethers.utils.parseEther('0.1');

      expect(prev_rate).not.to.be.equal(rate);

      const tx = await omnuumExchange.updateTmpExchangeRate(rate);

      await tx.wait();

      const exchange_rate = await omnuumExchange.getExchangeAmount(nullAddress, Constants.chainlink.rinkeby.LINK, uintAmount);

      expect(exchange_rate).to.be.equal(rate);
    });

    it('[Revert] Only omnuum can update rate', async () => {
      const { omnuumExchange, accounts } = this;

      const rate = ethers.utils.parseEther('0.1');

      expect(omnuumExchange.connect(accounts[1]).updateTmpExchangeRate(rate)).to.be.revertedWith(Constants.reasons.code.OO3);
    });
  });
  describe('[Method] withdraw', () => {
    it('Withdraw successfully', async () => {
      const { omnuumExchange, mockLink, accounts } = this;

      const value = ethers.utils.parseEther('1.5');
      const test_link_move_amount = ethers.utils.parseEther('1');

      // 1. send ether to exchange
      const deposit_tx = await omnuumExchange.exchangeToken(mockLink.address, test_link_move_amount, accounts[1].address, {
        value,
      });

      await deposit_tx.wait();

      const prev_bal = await accounts[0].getBalance();

      const withdraw_receipt = await (await omnuumExchange.withdraw()).wait();

      const withdraw_gas_fee = withdraw_receipt.gasUsed.mul(withdraw_receipt.effectiveGasPrice);

      const cur_bal = await accounts[0].getBalance();

      expect(cur_bal).to.equal(prev_bal.add(value).sub(withdraw_gas_fee));
    });

    it('[Revert] Only omnuum can withdraw', async () => {
      const { omnuumExchange, accounts } = this;

      expect(omnuumExchange.connect(accounts[1]).withdraw()).to.be.revertedWith(Constants.reasons.code.OO3);
    });
  });
});
