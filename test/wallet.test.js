/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

const { mapL, mapC, zip, zipWithIndexL, range, go, takeAll, reduce } = require('fxjs');

const { testDeploy, prepareDeploy, prepareMockDeploy } = require('./etc/mock.js');
const { testValues, events, reasons } = require('../utils/constants');

upgrades.silenceWarnings();

const sendEtherToWallet = async ({ sender, sendData, sendEthValue }) => {
  const send_tx = await sender.sendTransaction({
    to: this.omnuumWallet.address,
    data: sendData,
    value: ethers.utils.parseEther(sendEthValue),
  });
  await send_tx.wait();
  return send_tx;
};

const requestWithdrawal = async ({ signer, reqValue }) => {
  const request_withdrawal_value = ethers.utils.parseEther(reqValue);
  const req_tx = await this.omnuumWallet.connect(signer).approvalRequest(request_withdrawal_value);
  await req_tx.wait();
  return req_tx;
};

describe('Wallet', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Constructor] Wallet Owner Address Registration', () => {
    it('Register owners members correctly', async () => {
      const registeredOwners = await go(
        range(testValues.walletOwnersLen),
        mapC((idx) => this.omnuumWallet.owners(idx)),
      );
      expect(registeredOwners).to.deep.equal(this.walletOwners.map((owner) => owner.address));
    });

    it('[Revert] Registered only owners, not other account', async () => {
      await expect(this.omnuumWallet.owners(testValues.walletOwnersLen)).to.be.reverted;
    });
  });

  describe('[Method] Fallback fee receiver', () => {
    it('Can receive ETH correctly with or without data and emit FeeReceived event', async () => {
      const nftAddress = this.omnuumNFT1155.address;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTxWithData = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });

      await expect(sendTxWithData)
        .to.emit(this.omnuumWallet, events.Wallet.FeeReceived)
        .withArgs(nftAddress, projectOwner, ethers.utils.parseEther(testValues.sendEthValue));

      const sendTxWithoutData = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });

      await expect(sendTxWithoutData)
        .to.emit(this.omnuumWallet, events.Wallet.FeeReceived)
        .withArgs(ethers.constants.AddressZero, projectOwner, ethers.utils.parseEther(testValues.sendEthValue));
    });
    it('Receive Fee correctly with data', async () => {
      const nftAddress = this.omnuumNFT1155.address;
      const walletAddress = this.omnuumWallet.address;
      const projectOwner = await this.omnuumNFT1155.owner();
      const beforeWalletBalance = await ethers.provider.getBalance(walletAddress);
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();

      const afterWalletBalance = await ethers.provider.getBalance(walletAddress);
      expect(afterWalletBalance.sub(beforeWalletBalance).toString()).to.equal(ethers.utils.parseEther(testValues.sendEthValue));
    });
    it('Receive Fee correctly without data', async () => {
      const projectOwner = await this.omnuumNFT1155.owner();
      const walletAddress = this.omnuumWallet.address;
      const beforeWalletBalance = await ethers.provider.getBalance(walletAddress);
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();

      const afterWalletBalance = await ethers.provider.getBalance(walletAddress);
      expect(afterWalletBalance.sub(beforeWalletBalance).toString()).to.equal(ethers.utils.parseEther(testValues.sendEthValue));
    });
    it('Receive Accumulated fee from multiple accounts', async () => {
      const CHARITY_MEMBERS_LEN = 10;
      const walletAddress = this.omnuumWallet.address;
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
            sender: signer,
            sendEthValue: sendValue,
          }),
        ),
      );

      await go(
        sendTxs,
        zipWithIndexL,
        mapC(async ([idx, sendTx]) => {
          await expect(sendTx)
            .to.emit(this.omnuumWallet, events.Wallet.FeeReceived)
            .withArgs(ethers.constants.AddressZero, charitySigners[idx].address, ethers.utils.parseEther(charityValues[idx]));
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

  describe('[Method] Approval request', () => {

    it('Can request approval and emit requested and approval Events when owner requests', async () => {
      const requester = this.walletOwners[0];
      const reqTx = await requestWithdrawal({ signer: requester, reqValue: '0' });
      const reqId = '0';
      await expect(reqTx).to.emit(this.omnuumWallet, events.Wallet.Requested).withArgs(reqId, requester.address);
      await expect(reqTx).to.emit(this.omnuumWallet, events.Wallet.Approved).withArgs(reqId, requester.address);

      expect(await this.omnuumWallet.checkApproval(reqId, requester.address)).to.be.true;
    });
    it('[Revert] Only permit wallet owners', async () => {
      const [notOwner] = this.accounts;
      expect(this.walletOwners.map((owner) => owner.address))
        .to.be.an('array')
        .that.does.not.include(notOwner.address);

      const request_withdrawal_value = ethers.utils.parseEther('0');
      await expect(this.omnuumWallet.approvalRequest(request_withdrawal_value)).to.be.revertedWith(reasons.wallet.onlyOwner);
    });
    it('[Revert] Request more ETH than current contract balance', async () => {
      const requester = this.walletOwners[0];
      const projectOwner = await this.omnuumNFT1155.owner();
      const walletAddress = this.omnuumWallet.address;
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();
      const currentWalletBalance = await ethers.provider.getBalance(walletAddress);
      await expect(this.omnuumWallet.connect(requester).approvalRequest(currentWalletBalance.add(1))).to.be.revertedWith(
        reasons.wallet.notEnoughBalance,
      );
    });
  });

  describe('[Method] Approve', () => {
    it('Can approve event and emit Approved event', async () => {
      const projectOwner = await this.omnuumNFT1155.owner();
      const [requester, approver] = this.walletOwners;
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      const reqId = '0';
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const txApprove = await this.omnuumWallet.connect(approver).approve(reqId);
      await txApprove.wait();
      await expect(txApprove).to.emit(this.omnuumWallet, events.Wallet.Approved).withArgs('0', approver.address);

      // requester + approver = 2
      expect(await this.omnuumWallet.getApprovalCount(reqId)).to.be.equal(2);
    });
    it('[Revert] Only permit wallet owners', async () => {
      const [notOwner] = await ethers.getSigners();
      await expect(this.omnuumWallet.connect(notOwner).approve(0)).to.be.revertedWith(reasons.wallet.onlyOwner);
    });
    it('[Revert] Approve only existed request', async () => {
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const [requester, approver] = this.walletOwners;
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });

      const existReqId = '0';
      const notExistReqId = '1';

      await expect(wallet.requests(existReqId)).to.not.be.reverted;

      await expect(wallet.connect(approver).approve(existReqId)).to.not.be.revertedWith(reasons.wallet.reqNotExists);

      await expect(wallet.requests(notExistReqId)).to.be.reverted;
      await expect(wallet.connect(approver).approve(notExistReqId)).to.be.revertedWith(reasons.wallet.reqNotExists);
    });
    it('[Revert] Approve can be once', async () => {
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const [requester, approver] = this.walletOwners;
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      await (await wallet.connect(approver).approve('0')).wait();

      await expect(wallet.connect(approver).approve('0')).to.be.revertedWith(reasons.wallet.alreadyApproved);
    });
  });

  describe('[Method] revokeApproval', () => {
    it('Can revoke approval and emit Revoked event', async () => {
      const [requester, approver] = this.walletOwners;
      const wallet = this.omnuumWallet.connect(approver);
      const projectOwner = await this.omnuumNFT1155.owner();
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const reqId = '0';

      await (await wallet.approve(reqId)).wait();
      await expect(wallet.revokeApproval(reqId)).to.be.emit(wallet, 'Revoked').withArgs(reqId, approver.address);
    });
    it('[Revert] Only permit wallet owners', async () => {
      const [notOwner] = await ethers.getSigners();
      const [requester, approver] = this.walletOwners;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const reqId = '0';
      await (await wallet.connect(approver).approve(reqId)).wait();
      await expect(wallet.connect(notOwner).revokeApproval(reqId)).to.be.revertedWith(reasons.wallet.onlyOwner);
    });
    it('[Revert] Revoke approval once', async () => {
      const [requester, approver] = this.walletOwners;
      const wallet = this.omnuumWallet.connect(approver);
      const projectOwner = await this.omnuumNFT1155.owner();
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const reqId = '0';
      await (await wallet.approve(reqId)).wait();
      await (await wallet.revokeApproval(reqId)).wait();
      await expect(wallet.revokeApproval(reqId)).to.be.revertedWith(reasons.wallet.notApproved);
    });
    it('[Revert] Revoke only existed request', async () => {
      const [requester, approver] = this.walletOwners;
      const wallet = this.omnuumWallet.connect(approver);
      const projectOwner = await this.omnuumNFT1155.owner();
      await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendEthValue: testValues.sendEthValue,
      });
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const existedReqId = '0';
      const notExistedReqId = '1';
      await (await wallet.approve(existedReqId)).wait();
      await expect(wallet.revokeApproval(notExistedReqId)).to.be.revertedWith(reasons.wallet.reqNotExists);
    });
  });

  describe('[Method] withdrawal', () => {
    it('Can withdraw ETH to requester correctly and emit Withdrawn event', async () => {
      // send ETH to wallet
      const nftAddress = this.omnuumNFT1155.address;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();

      // request by owner
      const [requester, ...approvers] = this.walletOwners;
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });

      // approve by other owners
      const reqId = '0';
      await go(
        approvers,
        mapC((approver) => wallet.connect(approver).approve(reqId)),
        mapC((tx) => tx.wait()),
      );

      // check consensus (unanimous)
      expect((await wallet.getApprovalCount(reqId)).toNumber()).to.be.equal(this.walletOwners.length);

      const beforeRequesterBalance = await requester.getBalance();

      // withdrawal transaction by requester
      const txWithdrawal = await wallet.connect(requester).withdrawal(reqId);
      const receipt = await txWithdrawal.wait();
      const afterRequesterBalance = await requester.getBalance();
      const withdrawal_gas_cost = receipt.gasUsed.mul(txWithdrawal.gasPrice);

      expect(afterRequesterBalance.sub(beforeRequesterBalance).add(withdrawal_gas_cost).toString()).to.be.equal(
        ethers.utils.parseEther(testValues.sendEthValue),
      );

      const walletBalance = await ethers.provider.getBalance(wallet.address);
      expect(walletBalance.toString()).to.be.equal(ethers.utils.parseEther('0'));
    });

    it('[Revert] Only owner can withdraw', async () => {
      const nftAddress = this.omnuumNFT1155.address;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();

      // request by owner
      const [requester, ...approvers] = this.walletOwners;
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });

      // approve by other owners
      const reqId = '0';
      await go(
        approvers,
        mapC((approver) => wallet.connect(approver).approve(reqId)),
        mapC((tx) => tx.wait()),
      );


      await expect(wallet.connect(this.accounts[0]).withdrawal(reqId)).to.be.revertedWith(reasons.wallet.onlyOwner);
    });
    it('[Revert] Withdraw by other owner', async () => {
      // send ETH to wallet
      const nftAddress = this.omnuumNFT1155.address;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });
      await sendTx.wait();

      // request by owner
      const [requester, ...approvers] = this.walletOwners;
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });

      // approve by other owners
      const reqId = '0';
      await go(
        approvers,
        mapC((approver) => wallet.connect(approver).approve(reqId)),
        mapC((tx) => tx.wait()),
      );

      // withdraw by different owner
      await expect(wallet.connect(approvers[0]).withdrawal(reqId)).to.be.revertedWith(reasons.wallet.notRequester);
    });
    it('[Revert] Only withdraw once', async () => {
      // send ETH to wallet
      const nftAddress = this.omnuumNFT1155.address;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });
      await sendTx.wait();

      // request by owner
      const [requester, ...approvers] = this.walletOwners;
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });

      // approve by other owners
      const reqId = '0';
      await go(
        approvers,
        mapC((approver) => wallet.connect(approver).approve(reqId)),
        mapC((tx) => tx.wait()),
      );

      await (await wallet.connect(requester).withdrawal(reqId)).wait();
      await expect(wallet.connect(requester).withdrawal(reqId)).to.be.revertedWith(reasons.wallet.alreadyWithdrawn);
    });
    it('[Revert] Consensus is required', async () => {
      // send ETH to wallet
      const nftAddress = this.omnuumNFT1155.address;
      const wallet = this.omnuumWallet;
      const projectOwner = await this.omnuumNFT1155.owner();
      const sendTx = await sendEtherToWallet({
        sender: ethers.provider.getSigner(projectOwner),
        sendData: nftAddress,
        sendEthValue: testValues.sendEthValue,
      });

      await sendTx.wait();

      // request by owner
      const [requester, ...approvers] = this.walletOwners;
      await requestWithdrawal({ signer: requester, reqValue: testValues.sendEthValue });
      const reqId = '0';
      await (await wallet.connect(approvers[0]).approve(reqId)).wait();
      await expect(wallet.connect(requester).withdrawal(reqId)).to.be.revertedWith(reasons.wallet.consensusNotReached);
    });
  });
});
