/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { mapL, mapC, zip, zipWithIndexL, range, go, takeAll, reduce } = require('fxjs');

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  this.accounts = accounts;

  // Wallet Factory
  const WalletFactory = await ethers.getContractFactory('OmnuumWallet');

  // Deploy Wallet
  const mock_nft_contract = accounts[1];
  this.mock_nft_contract = mock_nft_contract;

  const owners_len = 10;
  const starting_signer_idx = 50;
  const wallet_owners = accounts.slice(starting_signer_idx, starting_signer_idx + owners_len);
  this.wallet_owners = wallet_owners;
  const wallet_owners_addresses = wallet_owners.map((x) => x.address);
  this.wallet_owners_addresses = wallet_owners_addresses;
  const wallet = await (await WalletFactory.deploy(wallet_owners_addresses)).deployed();
  this.wallet = wallet;
});

const sendEtherToWallet = async (who_signer, send_eth_value) => {
  const send_value_amount = ethers.utils.parseEther(send_eth_value);

  const send_signer = who_signer;
  const send_data = who_signer.address;
  const send_tx = await send_signer.sendTransaction({
    to: this.wallet.address,
    data: send_data,
    value: send_value_amount,
  });

  await send_tx.wait();
  return send_tx;
};

describe('Wallet Contract', () => {
  it('can register all the wallet owners?', async () => {
    const registered_owners = await go(
      range(this.wallet_owners_addresses.length),
      mapC((idx) => this.wallet.owners(idx)),
    );

    expect(registered_owners).to.deep.equal(this.wallet_owners_addresses);

    await expect(this.wallet.owners(this.wallet_owners_addresses.length)).to.be.reverted;
  });
});

describe('Wallet Contract', () => {
  it('can receive ETH?', async () => {
    const SEND_ETH = '10';
    const send_tx = await sendEtherToWallet(this.mock_nft_contract, `${SEND_ETH}`);

    await send_tx.wait();

    await expect(send_tx)
      .to.emit(this.wallet, 'FeeReceived')
      .withArgs(this.mock_nft_contract.address, this.mock_nft_contract.address, ethers.BigNumber.from(ethers.utils.parseEther(SEND_ETH)));

    expect((await ethers.provider.getBalance(this.wallet.address)).toString()).to.be.equal(ethers.utils.parseEther(SEND_ETH));
  });

  it('can receive multiple ETH from multiple addresses with accumulation?', async () => {
    const CHARITY_MEMBERS_LEN = 10;
    const charity_signers = (await ethers.getSigners()).slice(-CHARITY_MEMBERS_LEN);

    const charity_values = go(
      range(CHARITY_MEMBERS_LEN),
      mapL((x) => (x + 1) * Math.random()),
      mapL((x) => ethers.utils.parseEther(`${x}`)),
      takeAll,
    );

    const send_transactions_receipts = await go(
      charity_signers,
      zip(charity_values),
      mapC(([send_value, signer]) =>
        signer.sendTransaction({
          to: this.wallet.address,
          value: send_value,
        }),
      ),
    );

    go(
      send_transactions_receipts,
      zipWithIndexL,
      mapC(async ([idx, send_tx]) => {
        await expect(send_tx)
          .to.emit(this.wallet, 'FeeReceived')
          .withArgs(ethers.constants.AddressZero, charity_signers[idx].address, charity_values[idx]);
      }),
    );

    const wallet_balance = await ethers.provider.getBalance(this.wallet.address);

    const total_charity_values = reduce((acc, a) => {
      if (!acc) return acc;
      // eslint-disable-next-line no-param-reassign
      acc = acc.add(a);
      return acc;
    }, charity_values);

    expect(wallet_balance).to.be.equal(total_charity_values);
  });
});

const requestWithdrawal = async (who_signer, req_value) => {
  const request_withdrawal_value = ethers.utils.parseEther(req_value);
  const req_tx = await this.wallet.connect(who_signer).requestApproval(request_withdrawal_value);
  await req_tx.wait();
  return req_tx;
};

describe('requestApproval function', () => {
  it('can only permit owner?', async () => {
    const [not_owner] = await ethers.getSigners();
    expect(this.wallet_owners_addresses).to.be.an('array').that.does.not.include(not_owner.address);

    const REQ_VALUE = '0';
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);
    await expect(this.wallet.requestApproval(request_withdrawal_value)).to.be.reverted;
  });

  it('can request by owner?', async () => {
    const requester = this.wallet_owners[0];
    const req_tx = await requestWithdrawal(requester, '0');
    const expected_req_id = '0';
    await expect(req_tx).to.emit(this.wallet, 'Requested').withArgs(expected_req_id, requester.address);

    await expect(req_tx).to.emit(this.wallet, 'Approved').withArgs(expected_req_id, requester.address);

    expect(await this.wallet.approvals(expected_req_id, requester.address)).to.be.true;
  });

  it('can block request more ETH than contract balance', async () => {
    const SEND_ETH = 10;
    await sendEtherToWallet(this.mock_nft_contract, `${SEND_ETH}`);

    const requester = this.wallet_owners[0];
    const REQ_VALUE = `${SEND_ETH + 1}`;
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);

    await expect(this.wallet.connect(requester).requestApproval(request_withdrawal_value)).to.be.reverted;
  });
});

describe('approve function', () => {
  it('revert approve when call by not owner', async () => {
    const [not_owner] = await ethers.getSigners();
    await expect(this.wallet.connect(not_owner).approve(0)).to.be.revertedWith('Only Owner is permitted');
  });
  it('only owner can approve?', async () => {
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    const [requester, approver, ...other_owners] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    await expect(this.wallet.connect(approver).approve('0')).to.not.be.reverted;

    expect(await this.wallet.approvals('0', approver.address)).to.be.true;

    await go(
      other_owners,
      mapC((owner) => this.wallet.approvals('0', owner.address)),
      mapC((x) => expect(x).to.be.false),
    );
  });

  it('can emit Approved event?', async () => {
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    const tx_approve = await this.wallet.connect(approver).approve('0');
    await tx_approve.wait();

    await expect(tx_approve).to.emit(this.wallet, 'Approved').withArgs('0', approver.address);
  });

  it('can approve the request only exists', async () => {
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    const exist_req_id = '0';
    const not_exist_req_id = '1';

    await expect(this.wallet.requests(exist_req_id)).to.not.be.reverted;
    await expect(this.wallet.connect(approver).approve(exist_req_id)).to.not.be.reverted;

    await expect(this.wallet.requests(not_exist_req_id)).to.be.reverted;
    await expect(this.wallet.connect(approver).approve(not_exist_req_id)).to.be.reverted;
  });
});

describe('revokeApproval function', () => {
  it('can revoke approval', async () => {
    const moneyBuza = this.mock_nft_contract;
    const send_value = '10';
    await sendEtherToWallet(moneyBuza, send_value);

    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');
    const req_id = '0';

    await this.wallet.connect(approver).approve(req_id);

    expect(await this.wallet.approvals(req_id, approver.address)).to.be.true;
    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(2);

    const tx_revoke = await this.wallet.connect(approver).revokeApproval(req_id);

    expect(await this.wallet.approvals(req_id, approver.address)).to.be.false;
    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(1);

    await expect(tx_revoke).to.be.emit(this.wallet, 'Revoked').withArgs('0', approver.address);
  });
});

describe('withdrawal function', () => {
  it('can withdrawal when condition of unanimous', async () => {
    const moneyBuza = this.mock_nft_contract;
    const send_value = '10';
    await sendEtherToWallet(moneyBuza, send_value);

    const [requester, early_approver, ...late_approvers] = this.wallet_owners;
    const req_value = '9';
    await requestWithdrawal(requester, req_value);
    const req_id = '0';

    await (await this.wallet.connect(early_approver).approve(req_id)).wait();

    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.lessThan(this.wallet_owners.length);

    await expect(this.wallet.connect(requester).withdrawal(req_id)).to.be.reverted;

    await go(
      late_approvers,
      mapC((approver) => this.wallet.connect(approver).approve(req_id)),
    );

    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(this.wallet_owners.length);

    const before_requester_balance = await requester.getBalance();

    const tx_withdrawal = await this.wallet.connect(requester).withdrawal(req_id);
    const receipt = await tx_withdrawal.wait();

    await expect(tx_withdrawal)
      .to.be.emit(this.wallet, 'Withdrawn')
      .withArgs(req_id, requester.address, ethers.utils.parseEther(req_value));

    const withdrawal_gas_cost = receipt.gasUsed.mul(tx_withdrawal.gasPrice);
    const after_requester_balance = await requester.getBalance();
    const wallet_balance = await ethers.provider.getBalance(this.wallet.address);
    expect(after_requester_balance.sub(before_requester_balance).add(withdrawal_gas_cost).toString()).to.be.equal(
      ethers.utils.parseEther(req_value),
    );

    const remaining_balance = ethers.utils.parseEther(`${+send_value - +req_value}`);
    expect(wallet_balance.toString()).to.be.equal(remaining_balance);

    expect((await this.wallet.requests(0)).withdrawn).to.be.true;

    await expect(this.wallet.connect(early_approver).approve(req_id)).to.be.reverted;
  });
});
