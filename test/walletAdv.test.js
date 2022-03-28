/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { mapL, each, mapC, zip, zipWithIndexL, range, go, takeAll, reduce } = require('fxjs');

const { testDeploy, prepareDeploy, prepareMockDeploy } = require('./etc/mock.js');
const { testValues, events, reasons } = require('../utils/constants');

upgrades.silenceWarnings();

const sendEtherToWallet = async ({ sendSigner, sendData, sendValueInEther }) => {
  const send_tx = await sendSigner.sendTransaction({
    to: this.omnuumWallet.address,
    data: sendData,
    value: ethers.utils.parseEther(sendValueInEther),
  });
  await send_tx.wait();
  return send_tx;
};

let accounts;
let Wallet;
let walletOwnerAccounts;
let walletOwnerSigner;
let NFT;

describe('Omnuum Multi-sig Wallet', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    accounts = this.accounts;
    await testDeploy.call(this, accounts);

    Wallet = this.omnuumWallet;
    NFT = this.omnuumNFT1155;
    walletOwnerSigner = this.walletOwnerSigner;
    walletOwnerAccounts = this.walletOwnerAccounts;
  });

  describe('[Constructor] works correctly', () => {
    it('Register owner accounts correctly', async () => {
      await go(
        walletOwnerAccounts,
        each(async ({ addr, vote }) => {
          expect(await Wallet.ownerVote(addr)).to.eq(vote);
        }),
      );
    });
    it('Register consensusRatio correctly', async () => {
      expect(await Wallet.consensusRatio()).to.eq(testValues.consensusRatio);
    });
    it('Register minLimitForConsensus correctly', async () => {
      expect(await Wallet.minLimitForConsensus()).to.eq(testValues.minLimitForConsensus);
    });
    it('[Revert] Registered only owners, not other account', async () => {
      expect(await Wallet.ownerVote(accounts[0].address)).to.eq(0);
    });
  });

  describe('[Method] receive', () => {
    it('Can receive ETH', async () => {
      const projectOwner = await NFT.owner();
      const sendTxWithData = await sendEtherToWallet({
        sendSigner: ethers.provider.getSigner(projectOwner),
        sendValueInEther: testValues.sendEthValue,
      });

      await expect(sendTxWithData).to.emit(Wallet, events.Wallet.EtherReceived);
    });
    it('Receive Fee correctly', async () => {
      const projectOwner = await NFT.owner();
      const walletAddress = Wallet.address;
      const beforeWalletBalance = await ethers.provider.getBalance(walletAddress);
      const sendTx = await sendEtherToWallet({
        sendSigner: ethers.provider.getSigner(projectOwner),
        sendValueInEther: testValues.sendEthValue,
      });

      await sendTx.wait();

      const afterWalletBalance = await ethers.provider.getBalance(walletAddress);
      expect(afterWalletBalance.sub(beforeWalletBalance).toString()).to.equal(ethers.utils.parseEther(testValues.sendEthValue));
    });
    it('Receive Accumulated fee from multiple accounts', async () => {
      const CHARITY_MEMBERS_LEN = 10;
      const walletAddress = Wallet.address;
      const charitySigners = (await ethers.getSigners()).slice(-CHARITY_MEMBERS_LEN);
      const charityValues = go(
        range(CHARITY_MEMBERS_LEN),
        mapL(() => `${Math.ceil(100 * Math.random())}`),
        takeAll,
      );

      const sendTxs = await go(
        charitySigners,
        zip(charityValues),
        mapC(([sendValue, signer]) =>
          sendEtherToWallet({
            sendSigner: signer,
            sendValueInEther: sendValue,
          }),
        ),
      );

      await go(
        sendTxs,
        mapC(async (sendTx) => {
          await expect(sendTx).to.emit(Wallet, events.Wallet.EtherReceived).withArgs(sendTx.from);
        }),
      );

      const totalSendValues = reduce(
        (acc, a) => {
          if (!acc) return acc;
          // eslint-disable-next-line no-param-reassign
          acc = acc.add(a);
          return acc;
        },
        charityValues.map((val) => ethers.utils.parseEther(val)),
      );

      expect(await ethers.provider.getBalance(walletAddress)).to.equal(totalSendValues);
    });
  });

  describe('[Method] makePayment', () => {
    it('Receive payment and emit event', async () => {
      const sendSigner = accounts[0];
      const value = ethers.utils.parseEther('1');

      const beforeWalletBalance = await ethers.provider.getBalance(Wallet.address);

      await expect(await Wallet.connect(sendSigner).makePayment(testValues.paymentTestTopic, testValues.paymentDescription, { value }))
        .to.emit(Wallet, events.Wallet.PaymentReceived)
        .withArgs(sendSigner.address, testValues.paymentTestTopic, testValues.paymentDescription);

      const afterWalletBalance = await ethers.provider.getBalance(Wallet.address);

      expect(afterWalletBalance.sub(beforeWalletBalance)).to.equal(value);
    });
    it('[Revert] Cannot send zero amount', async () => {
      await expect(Wallet.makePayment(testValues.paymentTestTopic, testValues.paymentDescription, { value: 0 })).to.be.revertedWith(
        reasons.wallet.useless,
      );
    });
  });

  const request = async ({
    walletContract,
    requestType = 0,
    currentAccount = testValues.zeroOwnerAccount,
    newAccount = testValues.zeroOwnerAccount,
    withdrawalAmount = 0,
  }) => walletContract.request(requestType, currentAccount, newAccount, withdrawalAmount);

  describe('[Method] request', () => {
    it('can make a request by owner', async () => {
      const ownerNo = 0;
      const requestSigner = walletOwnerSigner[ownerNo];
      const voteLevel = walletOwnerAccounts[ownerNo].vote;
      const requestId = 0;
      const requestType = 2;

      const txResponse = await request({
        requestType,
        walletContract: Wallet.connect(requestSigner),
      });

      // Confirm event emit
      // event Requested(address indexed owner, uint256 indexed requestId, RequestTypes indexed requestType)
      await expect(txResponse).to.emit(Wallet, events.Wallet.Requested).withArgs(requestSigner.address, requestId, requestType);
      const requestStorageDate = await Wallet.requests(requestId);

      expect(requestStorageDate.requester).to.eq(requestSigner.address);
      expect(requestStorageDate.requestType).to.eq(requestType);

      expect(requestStorageDate.currentOwner.addr, requestStorageDate.currentOwner.vote).to.eq(
        ...Object.values(testValues.zeroOwnerAccount),
      );
      expect(requestStorageDate.newOwner.addr, requestStorageDate.newOwner.vote).to.eq(...Object.values(testValues.zeroOwnerAccount));
      expect(requestStorageDate.withdrawalAmount).to.eq(0);
      expect(requestStorageDate.votes).to.eq(voteLevel);
      expect(requestStorageDate.isExecute).to.false;

      expect(await Wallet.isOwnerVoted(requestSigner.address, requestId)).to.true;
    });

    it('[Revert] request by now owner', async () => {
      const notOwnerSigner = accounts[0];
      await expect(
        request({
          walletContract: Wallet.connect(notOwnerSigner),
        }),
      ).to.be.revertedWith('Not owner');
    });
  });

  describe('[Method] approve', () => {
    it('can be approved by another owner', async () => {
      const requesterOwnerNo = 0;
      const approverOwnerNo = 1;
      const approveSigner = walletOwnerSigner[approverOwnerNo];
      const approverVoteLevel = walletOwnerAccounts[approverOwnerNo].vote;
      const requesterVoteLevel = walletOwnerAccounts[requesterOwnerNo].vote;
      const totalVoteLevel = approverVoteLevel + requesterVoteLevel;

      const requestId = 0;

      // Send a dummy request transaction before approval
      await request({
        walletContract: Wallet.connect(walletOwnerSigner[requesterOwnerNo]),
      });

      // Confirm event emit when approve
      // event Approved(address indexed owner, uint256 indexed requestId, OwnerVotes votes)
      await expect(await Wallet.connect(approveSigner).approve(requestId))
        .to.emit(Wallet, events.Wallet.Approved)
        .withArgs(approveSigner.address, requestId, approverVoteLevel);

      const requestStorageDate = await Wallet.requests(requestId);

      expect(requestStorageDate.votes).to.eq(totalVoteLevel);

      expect(await Wallet.isOwnerVoted(approveSigner.address, requestId)).to.true;
    });

    it('[Revert] if approve by not onwer', async () => {});
    it('[Revert] if approve to the request which is not exist', async () => {});
    it('[Revert] if approve to the request which is not already executed or canceled', async () => {});
    it('[Revert] if approve again', async () => {});
  });
});
