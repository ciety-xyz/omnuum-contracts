/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  const WalletContractFactory = await ethers.getContractFactory('OmnuumWallet');

  // deploy Wallet
  const deployer_address = ethers.utils.getAddress(accounts[0].address);
  this.deployer = deployer_address;
  this.nft_contract = ethers.utils.getAddress(accounts[9].address);
  const wallet_owner_addresses = accounts
    .slice(1, 4)
    .map((x) => ethers.utils.getAddress(x.address));

  const deploy_receipt = await (
    await WalletContractFactory.deploy(wallet_owner_addresses)
  ).deployed();

  this.wallet = deploy_receipt;
});
beforeEach(async () => {});
describe.only('Wallet', () => {
  it('blah', async () => {
    const signers = await ethers.getSigners();
    const mock_nft_contract = signers[signers.length - 1];

    const tx = await mock_nft_contract.sendTransaction({
      to: this.wallet.address,
      value: ethers.utils.parseEther('1.0')
    });

    // const iface = new ethers.utils.Interface(this.wallet.interface);
    console.log(this.wallet.interface);
    const receipt = await tx.wait();
    console.log('영수', receipt.logs);

    const events = receipt.logs.map((log) =>
      this.wallet.interface.parseLog(log)
    );
    console.log(events);
  });
});
