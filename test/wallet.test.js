/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  map,
  mapL,
  mapC,
  zip,
  head,
  range,
  go,
  sum,
  hi,
  takeAllC,
  takeAll,
  reduce
} = require('fxjs');

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  this.accounts = accounts;

  // Wallet Factory
  const WalletFactory = await ethers.getContractFactory('OmnuumWallet');

  // Deploy Wallet
  this.mock_nft_contract = accounts[1];
  this.mock_fee_sender = accounts[2];

  const mock_wallet_owners_addresses = accounts
    .slice(10, 12)
    .map((x) => x.address);

  const wallet = await (
    await WalletFactory.deploy(mock_wallet_owners_addresses)
  ).deployed();

  console.log(`Wallet Contract is deployed at ${wallet.address}\n\n`);
  this.wallet = wallet;
});

/*
 * 테스트 명세
 * 1. Wallet Contract 은 돈을 잘 받는가?
 * 2. 오너들의 주소를 잘 등록이 되었는가?
 * */

describe.only('지갑 컨트랙은', () => {
  it('내가 보낸 돈 잘 받니?', async () => {
    const send_ether_A = '1.2345';
    const send_value_amount = ethers.utils.parseEther(send_ether_A);

    // Contract 의 fallback function 은 data(address) 를 받는다.
    // EOA 가 직접 wallet contract 으로 돈을 보낼 때 (수수료 등) 특정 nft contract 에게 보낸다는 것을 data 에 실어서 보내는 용도

    const send_signer = this.mock_nft_contract;
    const send_data = this.mock_nft_contract.address;
    const send_tx_A = await send_signer.sendTransaction({
      to: this.wallet.address,
      data: send_data,
      value: send_value_amount
    });

    const send_tx_A_receipt = await send_tx_A.wait();

    const event = this.wallet.interface.parseLog(head(send_tx_A_receipt.logs));

    // 이벤트 - FeeReceived emit 되었는지 체크
    expect(event.name).to.be.equal('FeeReceived');

    // 보낸 돈이 제대로 갔는지 체크
    expect(event.args.value).to.be.equal(send_value_amount);

    // Wallet 의 balance 가 보낸 돈만큼 쌓였는지 체크
    const wallet_balance = await ethers.provider.getBalance(
      this.wallet.address
    );
    expect(wallet_balance).to.be.equal(send_value_amount);

    // 데이터로 실어 보낸 address 주소가 잘 갔는지 체크
    expect(event.args.nftContract).to.be.equal(send_data);

    // 보낸 사람 제대로 갔는지 체크
    expect(event.args.sender).to.be.equal(send_signer.address);
  });
  it('여러명이 돈 보내도 돈이 잘 쌓이니?', async () => {
    // 우리 월렛으로 기부하려고 하는 불특정 멤버들 10명 설정
    const charity_members_len = 2;
    const charity_signers = (await ethers.getSigners()).slice(
      -charity_members_len
    );

    // 기부금액 임의로 세팅
    const charity_values = go(
      range(charity_members_len),
      mapL((x) => (x + 1) * Math.random()),
      mapL((x) => ethers.utils.parseEther(`${x}`)),
      takeAll
    );

    // 불특정 멤버들이 불특정 돈을 마구마구 보냄
    await go(
      charity_signers,
      zip(charity_values),
      mapC(([send_value, signer]) =>
        signer.sendTransaction({
          to: this.wallet.address,
          value: send_value
        })
      )
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
