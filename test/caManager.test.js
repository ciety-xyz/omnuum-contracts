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
    it('Should register contract', async () => {
      const { omnuumCAManager, accounts } = this;

      const contractAddress = accounts[10].address;

      const tx = await omnuumCAManager.registerContract(contractAddress, Constants.ContractTopic.TEST);
      const topic_hashed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(Constants.ContractTopic.TEST));

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumCAManager, Constants.events.CAManager.ManagerContractRegistered)
        .withArgs(contractAddress, topic_hashed);
    });

    it('Should override existing contract at indexedContracts if same topic', async () => {
      const {
        omnuumCAManager,
        accounts: [, mock_contract, mock_contract2],
      } = this;

      await (await omnuumCAManager.registerContract(mock_contract.address, Constants.ContractTopic.TEST)).wait();

      const before_override = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(before_override).to.be.equal(mock_contract.address);

      await (await omnuumCAManager.registerContract(mock_contract2.address, Constants.ContractTopic.TEST)).wait();

      const after_override = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(after_override).to.be.equal(mock_contract2.address);

      // overrided, but still exist and must be registered
      const isExist = await omnuumCAManager.isRegistered(mock_contract.address);

      expect(isExist).to.be.true;
    });

    it('[Revert] Only owner can register', async () => {
      const {
        omnuumCAManager,
        accounts: [, not_omnuum, fake_contract],
      } = this;

      await expect(
        omnuumCAManager.connect(not_omnuum).registerContract(fake_contract.address, Constants.ContractTopic.TEST),
      ).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] removeContract, isRegistered', () => {
    it('Can remove contract', async () => {
      const { omnuumCAManager, accounts } = this;

      const contractAddress = accounts[10].address;

      await (await omnuumCAManager.registerContract(contractAddress, Constants.ContractTopic.TEST)).wait();
      const topic_hashed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(Constants.ContractTopic.TEST));

      const before_remove = await omnuumCAManager.isRegistered(contractAddress);
      expect(before_remove).to.be.true;

      const tx = await omnuumCAManager.removeContract(contractAddress);

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumCAManager, Constants.events.CAManager.ManagerContractRemoved)
        .withArgs(contractAddress, topic_hashed);

      const after_remove = await omnuumCAManager.isRegistered(contractAddress);
      expect(after_remove).to.be.false;

      // indexedContracts also removed
      const contract_address = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(contract_address).to.be.equal(nullAddress);
    });
    it('should not remove indexed contracts if indexed contract mapping overriden', async () => {
      const {
        omnuumCAManager,
        accounts: [, mock_contract, mock_contract2],
      } = this;

      await (await omnuumCAManager.registerContract(mock_contract.address, Constants.ContractTopic.TEST)).wait();

      await (await omnuumCAManager.registerContract(mock_contract2.address, Constants.ContractTopic.TEST)).wait();

      const tx = await omnuumCAManager.removeContract(mock_contract.address);
      await tx.wait();

      const contract_address = await omnuumCAManager.getContract(Constants.ContractTopic.TEST);
      expect(contract_address).to.be.equal(mock_contract2.address);
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

  describe('[Method] registerNftContract', () => {
    it('Can register NFT contract', async () => {
      const { omnuumCAManager, accounts } = this;

      const contractAddress = accounts[10].address;
      const initialOwnerAddress = accounts[9].address;

      const tx = await omnuumCAManager.registerNftContract(contractAddress, initialOwnerAddress);

      await tx.wait();

      await expect(tx)
        .to.emit(omnuumCAManager, Constants.events.CAManager.NftContractRegistered)
        .withArgs(contractAddress, initialOwnerAddress);

      const isRegistered = await omnuumCAManager.nftContracts(contractAddress);
      expect(isRegistered).to.be.true;
    });
  });
});
