/*
 * Test codes for Omnuum Multi Sig Wallet
 * */

const { expect } = require('chai');
const { ethers } = require('hardhat');

beforeEach(async () => {
  const accounts = await ethers.getSigners();

  // Wallet Factory
  const WalletFactory = await ethers.getContractFactory('OmnuumWallet');

  // Deploy Wallet
  this.mock_nft_contract_address = accounts[1].address;

  const mock_wallet_owners_addresses = accounts
    .slice(1, 4)
    .map((x) => x.address);

  const wallet = await (
    await WalletFactory.deploy(mock_wallet_owners_addresses)
  ).deployed();
  console.log(`Wallet Contract is deployed at\n${wallet.address}`);
  this.wallet = wallet;
});
describe.only('Wallet', () => {
  it('blah', async () => {});
});
