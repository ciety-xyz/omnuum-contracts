/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { map, mapL, filter, each, mapC, zip, sum, range, go, takeAll, reduce } = require('fxjs');

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
let walletOwnerSigners;
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
    walletOwnerSigners = this.walletOwnerSigner;
    walletOwnerAccounts = this.walletOwnerAccounts;
  });

  describe('[Constructor] works correctly', () => {
    it('Register owner accounts correctly', async () => {
      await go(
        walletOwnerAccounts,
        each(async ({ addr, vote }) => {
          expect(await Wallet.ownerVote(addr)).to.equal(vote);
        }),
      );
    });
    it('Register consensusRatio correctly', async () => {
      expect(await Wallet.consensusRatio()).to.equal(testValues.consensusRatio);
    });
    it('Register minLimitForConsensus correctly', async () => {
      expect(await Wallet.minLimitForConsensus()).to.equal(testValues.minLimitForConsensus);
    });
    it('[Revert] Registered only owners, not other account', async () => {
      expect(await Wallet.ownerVote(accounts[0].address)).to.equal(0);
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

      await expect(Wallet.connect(sendSigner).makePayment(testValues.paymentTestTopic, testValues.paymentDescription, { value }))
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
    withdrawalAmount = ethers.utils.parseEther('0'),
  }) => walletContract.request(requestType, currentAccount, newAccount, withdrawalAmount);

  describe('[Method] request', () => {
    it('can make a request by owner', async () => {
      const ownerNo = 0;
      const requestSigner = walletOwnerSigners[ownerNo];
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

      expect(requestStorageDate.requester).to.equal(requestSigner.address);
      expect(requestStorageDate.requestType).to.equal(requestType);

      expect(requestStorageDate.currentOwner.addr, requestStorageDate.currentOwner.vote).to.equal(
        ...Object.values(testValues.zeroOwnerAccount),
      );
      expect(requestStorageDate.newOwner.addr, requestStorageDate.newOwner.vote).to.equal(...Object.values(testValues.zeroOwnerAccount));
      expect(requestStorageDate.withdrawalAmount).to.equal(0);
      expect(requestStorageDate.votes).to.equal(voteLevel);
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

  const prepareRequest = async () => {
    const requesterOwnerNo = 0;
    const approverOwnerNo = 1;
    const approveOwnerSigner = walletOwnerSigners[approverOwnerNo];
    const requestOwnerSigner = walletOwnerSigners[requesterOwnerNo];
    const approverVoteLevel = walletOwnerAccounts[approverOwnerNo].vote;
    const requesterVoteLevel = walletOwnerAccounts[requesterOwnerNo].vote;
    const totalVoteLevel = approverVoteLevel + requesterVoteLevel;
    const requestId = 0;
    // Send a dummy request transaction before approval
    await request({
      walletContract: Wallet.connect(requestOwnerSigner),
    });
    return [approveOwnerSigner, requestOwnerSigner, totalVoteLevel, requestId, approverVoteLevel, requesterVoteLevel];
  };

  describe('[Method] approve', () => {
    let approveOwnerSigner;
    let requestOwnerSigner;
    let totalVoteLevel;
    let requestId;
    let approverVoteLevel;
    beforeEach(async () => {
      [approveOwnerSigner, requestOwnerSigner, totalVoteLevel, requestId, approverVoteLevel] = await prepareRequest();
    });
    it('can be approved by the owner', async () => {
      // Confirm event emit when approve
      // event Approved(address indexed owner, uint256 indexed requestId, OwnerVotes votes)
      await expect(Wallet.connect(approveOwnerSigner).approve(requestId))
        .to.emit(Wallet, events.Wallet.Approved)
        .withArgs(approveOwnerSigner.address, requestId, approverVoteLevel);

      const requestStorageDate = await Wallet.requests(requestId);

      expect(requestStorageDate.votes).to.equal(totalVoteLevel);
      expect(await Wallet.isOwnerVoted(approveOwnerSigner.address, requestId)).to.true;
    });

    it('[Revert] if approve by not onwer', async () => {
      const notOnwerSigner = accounts[0];
      await expect(Wallet.connect(notOnwerSigner).approve(requestId)).to.be.revertedWith('Not owner');
    });
    it('[Revert] if approve to the request which does not exist', async () => {
      await expect(Wallet.connect(approveOwnerSigner).approve(requestId + 1)).to.be.revertedWith('Request not exists');
    });
    it('[Revert] if approve to the request which is already executed', async () => {
      // Approve by the second owner
      await Wallet.connect(approveOwnerSigner).approve(requestId);

      const { votes } = await Wallet.requests(requestId);
      const requiredVotesForConsensus = await Wallet.requiredVotesForConsensus();

      // Check whether consensus is reached
      expect(votes.toNumber()).to.be.greaterThanOrEqual(requiredVotesForConsensus.toNumber());

      // Execute the request by requester owner
      await Wallet.connect(requestOwnerSigner).execute(requestId);

      // Confirm the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;

      // Another owner attempts to approve the request that has already been executed => revert
      const anotherOwnerSigner = walletOwnerSigners[2];
      await expect(Wallet.connect(anotherOwnerSigner).approve(requestId)).to.be.revertedWith('Already executed');
    });
    it('[Revert] if approve to the request which is already canceled', async () => {
      // Cancel by Requester
      await Wallet.connect(requestOwnerSigner).cancel(requestId);

      // Check the request is canceled (4 = cancel)
      expect((await Wallet.requests(requestId)).requestType).to.equal(4);

      // Another owner attempts to approve the request that has already been canceled => revert
      await expect(Wallet.connect(approveOwnerSigner).approve(requestId)).to.be.revertedWith('Request canceled');
    });
    it('[Revert] if approve again', async () => {
      // Approve
      await Wallet.connect(approveOwnerSigner).approve(requestId);

      // Approve again => revert
      await expect(Wallet.connect(approveOwnerSigner).approve(requestId)).to.be.revertedWith('Already voted');
    });
  });

  describe('[Method] revoke', () => {
    let approveOwnerSigner;
    let requestOwnerSigner;
    let requestId;
    let approverVoteLevel;
    let requesterVoteLevel;
    beforeEach(async () => {
      [approveOwnerSigner, requestOwnerSigner, , requestId, approverVoteLevel, requesterVoteLevel] = await prepareRequest();
      await Wallet.connect(approveOwnerSigner).approve(requestId);
    });
    it('can be revoked by the owner', async () => {
      await expect(Wallet.connect(approveOwnerSigner).revoke(requestId))
        .to.emit(Wallet, events.Wallet.Revoked)
        .withArgs(approveOwnerSigner.address, requestId, approverVoteLevel);

      // Check if the result is revoked
      const { votes } = await Wallet.requests(requestId);
      expect(votes).to.equal(requesterVoteLevel);
      expect(await Wallet.isOwnerVoted(approveOwnerSigner.address, requestId)).to.false;
    });
    it('[Revert] if revoke by not onwer', async () => {
      const notOWnerSigner = accounts[0];
      await expect(Wallet.connect(notOWnerSigner).revoke(requestId)).to.be.revertedWith('Not owner');
    });
    it('[Revert] if revoke to the request which does not exist', async () => {
      await expect(Wallet.connect(approveOwnerSigner).revoke(requestId + 1)).to.be.revertedWith('Request not exists');
    });
    it('[Revert] if revoke to the request which is already executed', async () => {
      const { votes } = await Wallet.requests(requestId);
      const requiredVotesForConsensus = await Wallet.requiredVotesForConsensus();

      // Check whether consensus is reached
      expect(votes.toNumber()).to.be.greaterThanOrEqual(requiredVotesForConsensus.toNumber());

      // Execute the request by requester owner
      await Wallet.connect(requestOwnerSigner).execute(requestId);

      // Confirm the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;

      await expect(Wallet.connect(approveOwnerSigner).revoke(requestId)).to.be.revertedWith('Already executed');
    });
    it('[Revert] if revoke to the request which is already canceled', async () => {
      // Cancel by Requester
      await Wallet.connect(requestOwnerSigner).cancel(requestId);

      // Check the request is canceled (4 = cancel)
      expect((await Wallet.requests(requestId)).requestType).to.equal(4);

      // Approver attempts to revoke the request that has already been canceled => revert
      await expect(Wallet.connect(approveOwnerSigner).revoke(requestId)).to.be.revertedWith('Request canceled');
    });
    it('[Revert] if revoke the request which is not been approved', async () => {
      const anotherApproverSigner = walletOwnerSigners[2];
      await expect(Wallet.connect(anotherApproverSigner).revoke(requestId)).to.be.revertedWith('Not voted');
    });
  });

  describe('[Method] cancel', () => {
    let approveOwnerSigner;
    let requestOwnerSigner;
    let requestId;
    beforeEach(async () => {
      [approveOwnerSigner, requestOwnerSigner, , requestId] = await prepareRequest();
    });
    it('can cancel the request only by requester', async () => {
      await expect(Wallet.connect(requestOwnerSigner).cancel(requestId))
        .to.emit(Wallet, events.Wallet.Canceled)
        .withArgs(requestOwnerSigner.address, requestId);
    });
    it('[Revert] if cancel by not owner', async () => {
      const notOnwerSigner = accounts[0];
      await expect(Wallet.connect(notOnwerSigner).cancel(requestId)).to.be.revertedWith('Only requester');
    });
    it('[Revert] if cancel to the request which does not exist', async () => {
      await expect(Wallet.connect(requestOwnerSigner).cancel(requestId + 1)).to.be.revertedWith('Request not exists');
    });
    it('[Revert] if cancel to the request which is already executed', async () => {
      await Wallet.connect(approveOwnerSigner).approve(requestId);

      const { votes } = await Wallet.requests(requestId);
      const requiredVotesForConsensus = await Wallet.requiredVotesForConsensus();

      // Check whether consensus is reached
      expect(votes.toNumber()).to.be.greaterThanOrEqual(requiredVotesForConsensus.toNumber());

      // Execute the request by requester owner
      await Wallet.connect(requestOwnerSigner).execute(requestId);

      // Confirm the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;

      // Requester attempts to cancel the request that has already been executed => revert
      await expect(Wallet.connect(requestOwnerSigner).cancel(requestId)).to.be.revertedWith('Already executed');
    });
    it('[Revert] if cancel to the request which is already canceled', async () => {
      // Cancel by Requester
      await Wallet.connect(requestOwnerSigner).cancel(requestId);

      // Check the request is canceled (4 = cancel)
      expect((await Wallet.requests(requestId)).requestType).to.equal(4);

      // Requester attempts to cancel again the request that has already been canceled => revert
      await expect(Wallet.connect(requestOwnerSigner).cancel(requestId)).to.be.revertedWith('Request canceled');
    });
  });

  const makeAccountToArguments = (account) => [...Object.values(account)];

  describe('[Method] execute', () => {
    const requestNo = 0;
    const approverNo = 1;
    let requestOwnerSigner;
    let approverOwnerSigner;
    let currentAccountVoteTwo;
    let currentAccountVoteOne;
    let newOwnerAccount;
    const initialPaymentValue = '1';
    const withdrawalEtherAmount = '0.91911';

    let totalVotes;
    let levelOneOwnerCounter;
    let levelTwoOwnerCounter;
    const checkVoteLevel = 2;

    beforeEach(async () => {
      requestOwnerSigner = walletOwnerSigners[requestNo];
      approverOwnerSigner = walletOwnerSigners[approverNo];
      currentAccountVoteTwo = walletOwnerAccounts[approverNo];
      currentAccountVoteOne = { ...walletOwnerAccounts[approverNo], vote: 1 };
      newOwnerAccount = { addr: accounts[0].address, vote: 1 };
      const walletSignedByRequester = Wallet.connect(requestOwnerSigner);

      totalVotes = go(
        walletOwnerAccounts,
        map((account) => account.vote),
        sum,
      );

      levelOneOwnerCounter = go(
        walletOwnerAccounts,
        filter((account) => account.vote === 1),
      ).length;

      levelTwoOwnerCounter = go(
        walletOwnerAccounts,
        filter((account) => account.vote === 2),
      ).length;

      // Withdraw - RequestType: 0, requestId: 0
      await sendEtherToWallet({
        sendSigner: requestOwnerSigner,
        sendValueInEther: initialPaymentValue,
      });
      await request({
        requestType: 0,
        walletContract: walletSignedByRequester,
        withdrawalAmount: ethers.utils.parseEther(withdrawalEtherAmount),
      });
      await Wallet.connect(approverOwnerSigner).approve(0);

      // Add - RequestType: 1, requestId: 1
      await request({
        walletContract: walletSignedByRequester,
        requestType: 1,
        currentAccount: testValues.zeroOwnerAccount,
        newAccount: { addr: newOwnerAccount.addr, vote: newOwnerAccount.vote },
      });
      await Wallet.connect(approverOwnerSigner).approve(1);

      // Remove - RequestType: 2, requestId: 2
      await request({
        requestType: 2,
        walletContract: walletSignedByRequester,
        currentAccount: makeAccountToArguments(currentAccountVoteTwo),
      });
      await Wallet.connect(approverOwnerSigner).approve(2);

      // Change (owners) - RequestType: 3, requestId: 3
      await request({
        requestType: 3,
        walletContract: walletSignedByRequester,
        currentAccount: makeAccountToArguments(currentAccountVoteTwo),
        newAccount: makeAccountToArguments(newOwnerAccount),
      });
      await Wallet.connect(approverOwnerSigner).approve(3);

      // Change (level) - RequestType: 3, requestId: 4
      await request({
        requestType: 3,
        walletContract: walletSignedByRequester,
        currentAccount: makeAccountToArguments(currentAccountVoteTwo),
        newAccount: makeAccountToArguments(currentAccountVoteOne),
      });
      await Wallet.connect(approverOwnerSigner).approve(4);
    });

    it('can execute withdrawal', async () => {
      // withdrawal requestId: 0
      const requestId = 0;

      // Execute the request
      const tx = Wallet.connect(requestOwnerSigner).execute(requestId);
      await expect(tx).to.emit(Wallet, events.Wallet.Executed).withArgs(requestOwnerSigner.address, requestId, 0);

      // Check wallet balance change
      await expect(() => tx).to.changeEtherBalance(Wallet, ethers.utils.parseEther(`-${withdrawalEtherAmount}`));

      // Check owner balance has been added
      await expect(() => tx).to.changeEtherBalance(requestOwnerSigner, ethers.utils.parseEther(`${withdrawalEtherAmount}`));

      // Check wallet balance has been subtracted
      expect(await ethers.provider.getBalance(Wallet.address)).to.equal(
        ethers.utils.parseEther(initialPaymentValue).sub(ethers.utils.parseEther(withdrawalEtherAmount)),
      );

      // Check the status of the request changes executed to true
      expect((await Wallet.requests(requestId)).isExecute).to.true;
    });
    it('can execute add', async () => {
      // add requestId: 1
      const requestId = 1;

      // Check status before the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.false;
      expect(await Wallet.isOwner(newOwnerAccount.addr)).to.false;
      expect(await Wallet.totalVotes()).to.equal(totalVotes);
      expect(await Wallet.ownerCounter(checkVoteLevel)).to.equal(levelTwoOwnerCounter);

      // Execute add request
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId))
        .to.emit(Wallet, events.Wallet.Executed)
        .withArgs(requestOwnerSigner.address, requestId, 1);

      // Check status after the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;
      expect(await Wallet.isOwner(newOwnerAccount.addr)).to.true;
      expect(await Wallet.totalVotes()).to.equal(totalVotes + newOwnerAccount.vote);
    });
    it('can execute remove', async () => {
      // remove requestId: 2
      const requestId = 2;

      // Check status before the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.false;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.true;
      expect(await Wallet.totalVotes()).to.equal(totalVotes);
      expect(await Wallet.ownerCounter(checkVoteLevel)).to.equal(levelTwoOwnerCounter);

      // Execute add request
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId))
        .to.emit(Wallet, events.Wallet.Executed)
        .withArgs(requestOwnerSigner.address, requestId, 2);

      // Check status after the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.false;
      expect(await Wallet.totalVotes()).to.equal(totalVotes - currentAccountVoteTwo.vote);
      expect(await Wallet.ownerCounter(checkVoteLevel)).to.equal(levelTwoOwnerCounter - 1);
    });
    it('can execute change to other owner', async () => {
      // remove requestId: 3
      const requestId = 3;

      // Check status before the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.false;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.true;
      expect(await Wallet.totalVotes()).to.equal(totalVotes);
      expect(await Wallet.ownerCounter(1)).to.equal(levelOneOwnerCounter);
      expect(await Wallet.ownerCounter(2)).to.equal(levelTwoOwnerCounter);

      // Execute add request
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId))
        .to.emit(Wallet, events.Wallet.Executed)
        .withArgs(requestOwnerSigner.address, requestId, 3);

      // Check status after the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.false;
      expect(await Wallet.totalVotes()).to.equal(totalVotes - currentAccountVoteTwo.vote + newOwnerAccount.vote);
      expect(await Wallet.ownerCounter(2)).to.equal(levelTwoOwnerCounter - 1);
      expect(await Wallet.ownerCounter(1)).to.equal(levelOneOwnerCounter + 1);
    });
    it('can execute change the owner level', async () => {
      // remove requestId: 3
      const requestId = 4;

      // Check status before the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.false;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.true;
      expect(await Wallet.totalVotes()).to.equal(totalVotes);
      expect(await Wallet.ownerCounter(1)).to.equal(levelOneOwnerCounter);
      expect(await Wallet.ownerCounter(2)).to.equal(levelTwoOwnerCounter);

      // Execute add request
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId))
        .to.emit(Wallet, events.Wallet.Executed)
        .withArgs(requestOwnerSigner.address, requestId, 3);

      // Check status after the request is executed
      expect((await Wallet.requests(requestId)).isExecute).to.true;
      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.true;
      expect(await Wallet.totalVotes()).to.equal(totalVotes - currentAccountVoteTwo.vote + currentAccountVoteOne.vote);
      expect(await Wallet.ownerCounter(2)).to.equal(levelTwoOwnerCounter - 1);
      expect(await Wallet.ownerCounter(1)).to.equal(levelOneOwnerCounter + 1);
    });
    it('[Revert] if execute the request which does not exist', async () => {
      const notExistRequestId = 99;
      await expect(Wallet.connect(requestOwnerSigner).execute(notExistRequestId)).to.be.revertedWith('Request not exists');
    });
    it('[Revert] if execute the request which is already executed', async () => {
      const requestId = 0;

      // Request execution
      await Wallet.connect(requestOwnerSigner).execute(requestId);

      // Execute again
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Already executed');
    });
    it('[Revert] if execute the request which is already canceled', async () => {
      const requestId = 0;

      // Request cancel
      await Wallet.connect(requestOwnerSigner).cancel(requestId);

      // Execute again
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Request canceled');
    });
    it('[Revert] if execute by not requester', async () => {
      const requestId = 0;
      const notOwner = accounts[0];
      // Request cancel
      await expect(Wallet.connect(notOwner).cancel(requestId)).to.be.revertedWith('Only requester');
    });
    it('[Revert] if execute before reaching the consensus', async () => {
      const requestId = 0;

      // Revoke approval
      await Wallet.connect(approverOwnerSigner).revoke(requestId);

      // Execute request
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Not reach consensus');
    });
    it('[Revert] if execute the withdrawal if the contract balance is insufficient', async () => {
      // Request withdrawal with the larger amount than the balance of wallet contract
      const walletBalance = await ethers.provider.getBalance(Wallet.address);
      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 0, // Withdraw
        withdrawalAmount: walletBalance.add(ethers.utils.parseEther('1')),
      });

      const requestId = await Wallet.getLastRequestNo();
      await Wallet.connect(approverOwnerSigner).approve(requestId);

      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Insufficient balance');
    });
    it('[Revert] if execute the add new owner if the owner already one of members', async () => {
      // add request with the current existing account
      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 1, // Add
        currentAccount: testValues.zeroOwnerAccount,
        newAccount: currentAccountVoteTwo,
      });
      const requestId = await Wallet.getLastRequestNo();

      expect(await Wallet.isOwner(currentAccountVoteTwo.addr)).to.true;

      await Wallet.connect(approverOwnerSigner).approve(requestId);
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Already owner');
    });
    it('[Revert] if execute the addition of new owner if it is zero address or contract address', async () => {
      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 1, // Add
        currentAccount: testValues.zeroOwnerAccount,
        newAccount: testValues.zeroOwnerAccount,
      });
      const requestId = await Wallet.getLastRequestNo();

      await Wallet.connect(approverOwnerSigner).approve(requestId);
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Zero address not acceptable');
    });
    it('[Revert] if execute the change of owner account that does not satisfy the min number of votes for consensus', async () => {
      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 1, // Add
        currentAccount: testValues.zeroOwnerAccount,
        newAccount: { addr: Wallet.address, vote: 2 },
      });
      const requestId = await Wallet.getLastRequestNo();

      await Wallet.connect(approverOwnerSigner).approve(requestId);
      await expect(Wallet.connect(requestOwnerSigner).execute(requestId)).to.be.revertedWith('Contract address not acceptable');
    });
    it('[Revert] if execute the change of owner level that does not satisfy the min number of votes for consensus', async () => {
      const changeAccount = walletOwnerAccounts[0]; // Level two
      const changeAccountTobe = { ...walletOwnerAccounts[0], vote: 1 }; // Level one

      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 3, // Change
        currentAccount: changeAccount,
        newAccount: changeAccountTobe,
      });

      const lastRequestId = await Wallet.getLastRequestNo();
      await Wallet.connect(approverOwnerSigner).approve(lastRequestId);

      // Removal of vote two level owner
      const removalRequestId = 2;
      await Wallet.connect(requestOwnerSigner).execute(removalRequestId);

      await expect(Wallet.connect(requestOwnerSigner).execute(lastRequestId)).to.be.revertedWith('Violate min limit for consensus');
    });
    it('[Revert] if execute the removal of owner that does not exist', async () => {
      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 2, // Remove
        currentAccount: testValues.zeroOwnerAccount,
        newAccount: { addr: accounts[0].address, vote: 2 },
      });
      const lastRequestId = await Wallet.getLastRequestNo();
      await Wallet.connect(approverOwnerSigner).approve(lastRequestId);
      await expect(Wallet.connect(requestOwnerSigner).execute(lastRequestId)).to.be.revertedWith('Account not exist');
    });
    it('[Revert] if execute the removal of owner that does not satisfy the min number of votes for consensus', async () => {
      const removalRequestId = 2;
      await Wallet.connect(requestOwnerSigner).execute(removalRequestId);

      await request({
        walletContract: Wallet.connect(requestOwnerSigner),
        requestType: 2, // Remove
        currentAccount: walletOwnerAccounts[walletOwnerAccounts.length - 1],
        newAccount: testValues.zeroOwnerAccount,
      });
      const lastRequestId = await Wallet.getLastRequestNo();
      await Wallet.connect(walletOwnerSigners[walletOwnerSigners.length - 2]).approve(lastRequestId);

      await expect(Wallet.connect(requestOwnerSigner).execute(lastRequestId)).to.be.revertedWith('Violate min limit for consensus');
    });
  });
});
