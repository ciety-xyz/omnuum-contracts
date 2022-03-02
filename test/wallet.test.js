/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  mapL,
  mapC,
  zip,
  eachL,
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
    const send_ether = '1.2345';
    const send_value_amount = ethers.utils.parseEther(send_ether);

    // Contract 의 fallback function 은 data(address) 를 받는다.
    // EOA 가 직접 wallet contract 으로 돈을 보낼 때 (수수료 등) 특정 nft contract 에게 보낸다는 것을 data 에 실어서 보내는 용도

    const send_signer = this.mock_nft_contract;
    const send_data = this.mock_nft_contract.address;
    const send_tx = await send_signer.sendTransaction({
      to: this.wallet.address,
      data: send_data,
      value: send_value_amount
    });

    await send_tx.wait();

    // 돈 받는 이벤트 emit 이 제대로 되었는지 확인
    await expect(send_tx)
      .to.emit(this.wallet, 'FeeReceived')
      .withArgs(send_data, send_signer.address, send_value_amount);

    // Wallet 의 balance 가 보낸 돈만큼 쌓였는지 체크
    expect(await ethers.provider.getBalance(this.wallet.address)).to.be.equal(
      send_value_amount
    );
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
      eachL(async ([idx, send_tx]) => {
        await expect(send_tx)
          .to.emit(this.wallet, 'FeeReceived')
          .withArgs(
            ethers.constants.AddressZero,
            charity_signers[idx].address,
            charity_values[idx]
          );
      }),
      takeAll
    );

    // 우리 월렛에 쌓인 돈
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

describe('지갑 컨트랙 approvalRequest 함수는', () => {
  /*
  * function approvalRequest(uint256 _withdrawalValue)
      external
      onlyOwners
      returns (uint256)
  * 1. 오너가 아니면 revert
  * 2. 현재 Wallet 의 balance 까지 요청 가능. 그 이상 요청하면 revert
  * 3. requestId = 0 requests 검색해서 제대로 요청이 storage 저장 확인
  * 4. approve 되었는지 확인
  * 5. Requested 이벤트와 Approved 이벤트가 제대로 울렸는지 확인
  * 6. Approval 배열에 requestId = 0 에 msg.sender 가 제대로 승인 (true) 되었는지 확인
  * */

  it('오너가 아닌 사람이 요청하면 잘 막아?', async () => {
    // 컨트랙 배포자가 오너들에 포함 안 되어 있다는 것부터 먼저 확인하고.
    const [deployer] = await ethers.getSigners();
    expect(this.wallet_owners_addresses)
      .to.be.an('array')
      .that.does.not.include(deployer.address);

    // 오너가 아닌 녀석이 승인 리퀘 를 날리면 바로 리버트 될꺼야.
    const REQ_VALUE = '0';
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);
    await expect(this.wallet.approvalRequest(request_withdrawal_value)).to.be
      .reverted;
  });

  it('오너가 요청하면 잘 진행시키니?', async () => {
    // 오너 중에 리퀘스터 한명 선정하고,
    const requester = this.wallet_owners[0];

    // 오너인 리퀘스터가 리퀘스트를 날린다. 일단 금액은 0 Eth 요청.
    const REQ_VALUE = '0';
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);
    const tx = await this.wallet
      .connect(requester)
      .approvalRequest(request_withdrawal_value);

    // Requested 이벤트가 잘 emit 되었나?
    const expected_req_id = '0';
    await expect(tx)
      .to.emit(this.wallet, 'Requested')
      .withArgs(expected_req_id, requester.address);

    // 동시에 자가 셀프 Approve 도 하는데 이것도 잘 진행되었나?
    // 일단 Approved 이벤트가 emit 되었는지 확인해보자.
    await expect(tx)
      .to.emit(this.wallet, 'Approved')
      .withArgs(expected_req_id, requester.address);
    // 그리고 approvals 에 잘 기록되었는지 확인해볼까?
    expect(await this.wallet.approvals(expected_req_id, requester.address)).to
      .be.true;
  });

  it('금고 밸런스보다 더 큰 금액을 요청하는 오너를 막자', async () => {
    const value_sender = this.mock_nft_contract;

    const send_ether = '99';
    const send_value_amount = ethers.utils.parseEther(send_ether);

    // Contract 의 fallback function 은 data(address) 를 받는다.
    // EOA 가 직접 wallet contract 으로 돈을 보낼 때 (수수료 등) 특정 nft contract 에게 보낸다는 것을 data 에 실어서 보내는 용도

    const send_tx = await value_sender.sendTransaction({
      to: this.wallet.address,
      value: send_value_amount
    });
    await send_tx.wait();

    const requester = this.wallet_owners[0];
    const REQ_VALUE = `${+send_ether + 1}`;
    const request_withdrawal_value = ethers.utils.parseEther(REQ_VALUE);

    // 1 ether 더 큰 금액을 달라고 욕심내다니!
    await expect(
      this.wallet.connect(requester).approvalRequest(request_withdrawal_value)
    ).to.be.reverted;
  });
});
