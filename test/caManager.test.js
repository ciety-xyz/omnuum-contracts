const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const Constants = require('../utils/constants.js');
require('chai').should();

Error.stackTraceLimit = Infinity;

const { prepareDeploy, prepareMockDeploy, testDeploy } = require('./etc/mock.js');
const { nullAddress } = require('./etc/util.js');

upgrades.silenceWarnings();

describe('OmnuumCAManager', () => {
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
      const { omnuumCAManager, accounts } = this;

      await expect(omnuumCAManager.connect(accounts[1]).initialize()).to.be.revertedWith(Constants.reasons.common.initialize);
    });
  });

  describe('[Method] registerContract', () => {
    it('should register contract', async () => {
      const { omnuumCAManager, mockNFT: mockContract } = this;

      const tx = await omnuumCAManager.registerContract(mockContract.address, Constants.ContractTopic.TEST);

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumCAManager, Constants.events.CAManager.Updated)
        .withArgs(mockContract.address, [Constants.ContractTopic.TEST, true], 'register');
    });
    it('should override existing contract at indexedContracts if same topic', async () => {
      const { omnuumCAManager, mockNFT: mockContract, mockLink: mockContract2 } = this;

      await (await omnuumCAManager.registerContract(mockContract.address, Constants.ContractTopic.TEST)).wait();

      const before_override = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(before_override).to.be.equal(mockContract.address);

      await (await omnuumCAManager.registerContract(mockContract2.address, Constants.ContractTopic.TEST)).wait();

      const after_override = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(after_override).to.be.equal(mockContract2.address);

      // overrided, but still exist and must be registered
      const isExist = await omnuumCAManager.checkRegistration(mockContract.address);

      expect(isExist).to.be.true;
    });
    it('[Revert] only owner can register', async () => {
      const {
        omnuumCAManager,
        accounts: [, not_omnuum, fake_contract],
      } = this;

      await expect(
        omnuumCAManager.connect(not_omnuum).registerContract(fake_contract.address, Constants.ContractTopic.TEST),
      ).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
    it('[Revert] EOA should not be registered', async () => {
      const {
        omnuumCAManager,
        accounts: [, fake_contract],
      } = this;

      await expect(omnuumCAManager.registerContract(fake_contract.address, Constants.ContractTopic.TEST)).to.be.revertedWith(
        Constants.reasons.code.AE2,
      );
    });
  });

  describe('[Method] removeContract, checkRegistration', () => {
    it('can remove contract', async () => {
      const { omnuumCAManager, mockNFT: mockContract } = this;

      await (await omnuumCAManager.registerContract(mockContract.address, Constants.ContractTopic.TEST)).wait();

      const before_remove = await omnuumCAManager.checkRegistration(mockContract.address);
      expect(before_remove).to.be.true;

      const tx = await omnuumCAManager.removeContract(mockContract.address);

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumCAManager, Constants.events.CAManager.Updated)
        .withArgs(mockContract.address, [Constants.ContractTopic.TEST, true], 'remove');

      const after_remove = await omnuumCAManager.checkRegistration(mockContract.address);
      expect(after_remove).to.be.false;

      // indexedContracts also removed
      const contract_address = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(contract_address).to.be.equal(nullAddress);
    });

    it('should not remove indexed contracts if indexed contract mapping overriden', async () => {
      const { omnuumCAManager, mockNFT: mockContract, mockLink: mockContract2 } = this;

      await (await omnuumCAManager.registerContract(mockContract.address, Constants.ContractTopic.TEST)).wait();

      await (await omnuumCAManager.registerContract(mockContract2.address, Constants.ContractTopic.TEST)).wait();

      const tx = await omnuumCAManager.removeContract(mockContract.address);
      await tx.wait();

      const contract_address = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(contract_address).to.be.equal(mockContract2.address);
    });

    it('[Revert] only owner', async () => {
      const {
        omnuumCAManager,
        accounts: [omnuum, not_omnuum],
      } = this;

      await expect(omnuumCAManager.connect(not_omnuum).removeContract(omnuum.address)).to.be.revertedWith(
        Constants.reasons.common.onlyOwner,
      );
    });
  });
});
