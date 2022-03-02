/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  mapL,
  mapC,
  zip,
  zipWithIndexL,
  range,
  go,
  takeAll,
  reduce
} = require('fxjs');

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
  const wallet_owners = accounts.slice(
    starting_signer_idx,
    starting_signer_idx + owners_len
  );
  this.wallet_owners = wallet_owners;
  const wallet_owners_addresses = wallet_owners.map((x) => x.address);
  this.wallet_owners_addresses = wallet_owners_addresses;
  const wallet = await (
    await WalletFactory.deploy(wallet_owners_addresses)
  ).deployed();
  this.wallet = wallet;
});

const sendEtherToWallet = async (who_signer, send_eth_value) => {
  const send_value_amount = ethers.utils.parseEther(send_eth_value);

  // Contract 의 fallback function 은 data(address) 를 받는다.
  // EOA 가 직접 wallet contract 으로 돈을 보낼 때 (수수료 등) 특정 nft contract 에게 보낸다는 것을 data 에 실어서 보내는 용도

  const send_signer = who_signer;
  const send_data = who_signer.address;
  const send_tx = await send_signer.sendTransaction({
    to: this.wallet.address,
    data: send_data,
    value: send_value_amount
  });

  await send_tx.wait();
  return send_tx;
};

/*
 * 테스트 명세
 * 1. Wallet Contract 은 돈을 잘 받는가?
 * 2. 오너들의 주소를 잘 등록이 되었는가?
 * */
describe('지갑 컨트랙 BASIC', () => {
  it('공동 소유 오너 주소들은 잘 등록하니?', async () => {
    const registered_owners = await go(
      range(this.wallet_owners_addresses.length),
      mapC((idx) => this.wallet.owners(idx))
    );

    // deploy 할 때 변수로 넣은 owner 들의 주소와 컨트랙에 저장된 오너 배열이 같은지 체크
    expect(registered_owners).to.deep.equal(this.wallet_owners_addresses);

    // 컨트랙에 owners 배열에 더 추가된 주소는 없는지 체크
    await expect(this.wallet.owners(this.wallet_owners_addresses.length)).to.be
      .reverted;
  });
});

describe('지갑 컨트랙 돈 받는 함수는', () => {
  it('내가 보낸 돈 잘 받니?', async () => {
    // Contract 의 fallback function 은 data(address) 를 받는다.
    // EOA 가 직접 wallet contract 으로 돈을 보낼 때 (수수료 등) 특정 nft contract 에게 보낸다는 것을 data 에 실어서 보내는 용도
    const SEND_ETH = '10';
    const send_tx = await sendEtherToWallet(
      this.mock_nft_contract,
      `${SEND_ETH}`
    );

    await send_tx.wait();

    // 돈 받는 이벤트 emit 이 제대로 되었는지 확인
    await expect(send_tx)
      .to.emit(this.wallet, 'FeeReceived')
      .withArgs(
        this.mock_nft_contract.address,
        this.mock_nft_contract.address,
        ethers.BigNumber.from(ethers.utils.parseEther(SEND_ETH))
      );

    // Wallet 의 balance 가 보낸 돈만큼 쌓였는지 체크
    expect(
      (await ethers.provider.getBalance(this.wallet.address)).toString()
    ).to.be.equal(ethers.utils.parseEther(SEND_ETH));
  });

  it('여러명이 보낸 돈도 안 잃어버리고 잘 쌓아서 받니?', async () => {
    // 우리 월렛으로 기부하려고 하는 불특정 멤버들 10명 설정
    const CHARITY_MEMBERS_LEN = 10;
    const charity_signers = (await ethers.getSigners()).slice(
      -CHARITY_MEMBERS_LEN
    );

    // 기부금액 임의로 세팅
    const charity_values = go(
      range(CHARITY_MEMBERS_LEN),
      mapL((x) => (x + 1) * Math.random()),
      mapL((x) => ethers.utils.parseEther(`${x}`)),
      takeAll
    );

    // 불특정 멤버들이 불특정 돈을 마구마구 보냄
    const send_transactions_receipts = await go(
      charity_signers,
      zip(charity_values),
      mapC(([send_value, signer]) =>
        signer.sendTransaction({
          to: this.wallet.address,
          value: send_value
        })
      )
    );

    // receipt 에 이벤트가 다 잘 발생했는지 볼까?
    go(
      send_transactions_receipts,
      zipWithIndexL,
      mapC(async ([idx, send_tx]) => {
        await expect(send_tx)
          .to.emit(this.wallet, 'FeeReceived')
          .withArgs(
            ethers.constants.AddressZero,
            charity_signers[idx].address,
            charity_values[idx]
          );
      })
    );

    // 월렛에 쌓인 돈
    const wallet_balance = await ethers.provider.getBalance(
      this.wallet.address
    );

    const total_charity_values = reduce((acc, a) => {
      if (!acc) return acc;
      // eslint-disable-next-line no-param-reassign
      acc = acc.add(a);
      return acc;
    }, charity_values);

    // 사람들이 보낸 돈 제대로 쌓였는지 체크
    expect(wallet_balance).to.be.equal(total_charity_values);
  });
});

const requestWithdrawal = async (who_signer, req_value) => {
  const request_withdrawal_value = ethers.utils.parseEther(req_value);
  const req_tx = await this.wallet
    .connect(who_signer)
    .approvalRequest(request_withdrawal_value);
  await req_tx.wait();
  return req_tx;
};

describe('지갑 컨트랙 approvalRequest 함수는...', () => {
  it('오너가 아닌 사람이 요청하면 잘 막아?', async () => {
    // 컨트랙 배포자가 오너들에 포함 안 되어 있다는 것부터 먼저 확인하고.
    const [not_owner] = await ethers.getSigners();
    expect(this.wallet_owners_addresses)
      .to.be.an('array')
      .that.does.not.include(not_owner.address);

    // 오너가 아닌 지갑이 승인 리퀘 를 날리면 바로 리버트 될꺼야.
    const REQ_VALUE = '0';
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);
    await expect(this.wallet.approvalRequest(request_withdrawal_value)).to.be
      .reverted;
  });

  it('오너가 요청하면 잘 진행시키니?', async () => {
    // 오너 중에 리퀘스터 한명 선정하고,
    // 오너인 리퀘스터가 리퀘스트를 날린다. 일단 금액은 0 Eth 요청ㅎ.
    const requester = this.wallet_owners[0];
    const req_tx = await requestWithdrawal(requester, '0');
    // Requested 이벤트가 잘 emit 되었나?
    const expected_req_id = '0';
    await expect(req_tx)
      .to.emit(this.wallet, 'Requested')
      .withArgs(expected_req_id, requester.address);

    // 동시에 자가 셀프 Approve 도 하는데 이것도 잘 진행되었나?
    // 일단 Approved 이벤트가 emit 되었는지 확인해보자.
    await expect(req_tx)
      .to.emit(this.wallet, 'Approved')
      .withArgs(expected_req_id, requester.address);

    // 그리고 approvals 에 잘 기록되었는지 확인해볼까?
    expect(await this.wallet.approvals(expected_req_id, requester.address)).to
      .be.true;
  });

  it('금고 밸런스보다 더 큰 금액을 요청하는 오너를 막자', async () => {
    const SEND_ETH = 10;
    await sendEtherToWallet(this.mock_nft_contract, `${SEND_ETH}`);

    const requester = this.wallet_owners[0];
    const REQ_VALUE = `${SEND_ETH + 1}`;
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);

    // 감히 텅장 밸런스보다 1 ether 더 큰 금액을 달라고 욕심내다니!
    await expect(
      this.wallet.connect(requester).approvalRequest(request_withdrawal_value)
    ).to.be.reverted;
  });
});

describe('지갑 컨트랙 approve 함수는...', () => {
  it('오너가 아니면 approve 할 수 없어요.', async () => {
    const [not_owner] = await ethers.getSigners();
    await expect(this.wallet.connect(not_owner).approve(0)).to.be.revertedWith(
      'Only Owner is permitted'
    );
  });
  it('오너만이 approve 를 할 수 있어요.', async () => {
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    // 첫번째 오너가 9 eth 를 달라고 리퀘스트를 요청합니다.
    const [requester, approver, ...other_owners] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    // 두번째 오너가 approve 를 하고 revert 되지 않습니다.
    await expect(this.wallet.connect(approver).approve('0')).to.not.be.reverted;

    // 두번째 오너는 approve 가 기록되어 있습니다.
    expect(await this.wallet.approvals('0', approver.address)).to.be.true;

    // 다른 오너들은 모두 approve 되어 있지 않습니다.
    await go(
      other_owners,
      mapC((owner) => this.wallet.approvals('0', owner.address)),
      mapC((x) => expect(x).to.be.false)
    );
  });

  it('Approved 이벤트를 발생시킵니다.', async () => {
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    // 첫번째 오너가 9 eth 를 달라고 리퀘스트를 요청합니다.
    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    // 두번째 오너가 approve 를 합니다.
    const tx_approve = await this.wallet.connect(approver).approve('0');
    await tx_approve.wait();

    // Approved 이벤트가 발생합니다.
    await expect(tx_approve)
      .to.emit(this.wallet, 'Approved')
      .withArgs('0', approver.address);
  });

  it('존재하는 request 만 승인할 수 있어요.', async () => {
    // nft contract 이 지갑에 10 이더 돈을 보냈습니다.
    const moneyBuza = this.mock_nft_contract;
    await sendEtherToWallet(moneyBuza, '10');

    // 첫번째 오너가 9 eth 를 달라고 리퀘스트를 요청합니다.
    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');

    const exist_req_id = '0';
    const not_exist_req_id = '1';

    // 방금 request 한 0 번 request 는 revert 되지 않아요.
    await expect(this.wallet.requests(exist_req_id)).to.not.be.reverted;
    await expect(this.wallet.connect(approver).approve(exist_req_id)).to.not.be
      .reverted;

    // 존재하지 않는 request 에 대해서는 revert 발생해요.
    await expect(this.wallet.requests(not_exist_req_id)).to.be.reverted;
    await expect(this.wallet.connect(approver).approve(not_exist_req_id)).to.be
      .reverted;
  });
});

describe('지갑 컨트랙 revokeApproval 함수는...', () => {
  it('승인을 철회 할 수 있어요.', async () => {
    const moneyBuza = this.mock_nft_contract;
    const send_value = '10';
    await sendEtherToWallet(moneyBuza, send_value);

    // 첫번째 오너가 리퀘스트를 요청합니다.
    const [requester, approver] = this.wallet_owners;
    await requestWithdrawal(requester, '9');
    const req_id = '0';

    // 다른 오너가 승인을 합니다.
    await this.wallet.connect(approver).approve(req_id);

    // 승인됨을 확인합니다.
    expect(await this.wallet.approvals(req_id, approver.address)).to.be.true;
    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(
      2
    );

    // 이 오너가 승인을 물립니다.
    const tx_revoke = await this.wallet
      .connect(approver)
      .revokeApproval(req_id);

    // 승인 취소 됨을 확인합니다.
    expect(await this.wallet.approvals(req_id, approver.address)).to.be.false;
    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(
      1
    );

    // Revoked 이벤트가 emit 됨을 확인합니다.
    await expect(tx_revoke)
      .to.be.emit(this.wallet, 'Revoked')
      .withArgs('0', approver.address);
  });
});

describe('지갑 컨트랙 withdrawal 함수는...', () => {
  it('모두 만장일치어야지 인출이 가능해요.', async () => {
    // nft contract 이 지갑에 10 이더 돈을 보냈습니다.
    const moneyBuza = this.mock_nft_contract;
    const send_value = '10';
    await sendEtherToWallet(moneyBuza, send_value);

    // 첫번째 오너가 9 eth 를 달라고 리퀘스트를 요청합니다.
    const [requester, early_approver, ...late_approvers] = this.wallet_owners;
    const req_value = '9';
    await requestWithdrawal(requester, req_value);
    const req_id = '0';

    // early approver 한명이 승인을 하고 request 가 인출을 시도하면 실패할 겁니다.
    await (await this.wallet.connect(early_approver).approve(req_id)).wait();

    // 동의 수가 만장일치 수보다 적은 상황임
    expect(
      (await this.wallet.getApprovalCount(req_id)).toNumber()
    ).to.be.lessThan(this.wallet_owners.length);

    // 무모한 requester 가 인출을 시도합니다... 막힙니다.
    await expect(this.wallet.connect(requester).withdrawal(req_id)).to.be
      .reverted;

    // 다른 owner 들이 늦게나마 모두 approve 를 합니다.
    await go(
      late_approvers,
      mapC((approver) => this.wallet.connect(approver).approve(req_id))
    );

    // 모두 동의 되었는지 체크
    expect((await this.wallet.getApprovalCount(req_id)).toNumber()).to.be.equal(
      this.wallet_owners.length
    );

    const before_requester_balance = await requester.getBalance();

    // 그럼 인출이 가능해야 겠쥬?
    const tx_withdrawal = await this.wallet
      .connect(requester)
      .withdrawal(req_id);
    const receipt = await tx_withdrawal.wait();

    // Withdrawn 이벤트가 발생했는지 확인합니다.
    await expect(tx_withdrawal)
      .to.be.emit(this.wallet, 'Withdrawn')
      .withArgs(req_id, requester.address, ethers.utils.parseEther(req_value));

    // 인출 요청한 금액이 인출로 들어온 금액이랑 같은지 확인해 봅니다.
    // 단 가스 tx 가스 비용은 어쩔 수 없고... 가스 비용이랑 합산해서 평가합니다.
    const withdrawal_gas_cost = receipt.gasUsed.mul(tx_withdrawal.gasPrice);
    const after_requester_balance = await requester.getBalance();
    const wallet_balance = await ethers.provider.getBalance(
      this.wallet.address
    );
    // requester 한테 돈이 잘 들어왔습니다 :)
    expect(
      after_requester_balance
        .sub(before_requester_balance)
        .add(withdrawal_gas_cost)
        .toString()
    ).to.be.equal(ethers.utils.parseEther(req_value));

    // wallet 은 돈이 빠져나갔습니다ㅠ
    const remaining_balance = ethers.utils.parseEther(
      `${+send_value - +req_value}`
    );
    expect(wallet_balance.toString()).to.be.equal(remaining_balance);

    // 해당 request 에 인출 기록 여부를 확인합니다.
    expect((await this.wallet.requests(0)).withdrawn).to.be.true;

    // 한번 인출된 request 에는 owner 들이 appove 할 수 없습니다.
    await expect(this.wallet.connect(early_approver).approve(req_id)).to.be
      .reverted;
  });
});
