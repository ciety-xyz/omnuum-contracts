/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { head } = require('fxjs');

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  this.accounts = accounts;

  // Wallet Factory
  const WalletFactory = await ethers.getContractFactory('OmnuumWallet');

  // Deploy Wallet
  this.mock_nft_contract = accounts[1];

  const mock_wallet_owners_addresses = accounts
    .slice(1, 4)
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
    const send_value_amount = ethers.utils.parseEther('1.2345');
    const send_tx = await this.mock_nft_contract.sendTransaction({
      to: this.wallet.address,
      from: this.mock_nft_contract.address,
      data: this.mock_nft_contract.address,
      value: send_value_amount
    });
    const send_tx_receipt = await send_tx.wait();

    const event = this.wallet.interface.parseLog(head(send_tx_receipt.logs));
    console.log('evt', event);
  });
  // it('blah', async () => {
  //   const signers = await ethers.getSigners();
  //   const mock_nft_contract = signers[signers.length - 1];
  //
  //   const tx = await mock_nft_contract.sendTransaction({
  //     to: this.wallet.address,
  //     value: ethers.utils.parseEther('1.0')
  //   });
  //
  //   // const iface = new ethers.utils.Interface(this.wallet.interface);
  //   console.log(this.wallet.interface);
  //   const receipt = await tx.wait();
  //   console.log('영수', receipt.logs);
  //
  //   const events = receipt.logs.map((log) =>
  //     this.wallet.interface.parseLog(log)
  //   );
  //   console.log(events);
  // });
});
