const { ethers } = require('hardhat');
const { go, mapL, takeAll } = require('fxjs');

const walletOwnersAddresses = go(
  [process.env.ACCOUNT_TESTER_C, process.env.ACCOUNT_TESTER_D, process.env.ACCOUNT_TESTER_E],
  mapL((privateKey) => new ethers.Wallet(privateKey)),
  mapL((wallet) => wallet.address),
  takeAll,
);

console.log(walletOwnersAddresses);

module.exports = [walletOwnersAddresses];
