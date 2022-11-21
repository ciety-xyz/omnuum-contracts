const { ethers } = require('hardhat');

const iFace = new ethers.utils.Interface(['function initialize(address,address,uint32,string,address) public']);

const data = iFace.encodeFunctionData(iFace.getFunction('initialize'), [
  '0x4E80cABF3Ad2a4d1abD1Bbd2e511A7eA8e8cCdf9', // caManager
  '0x6F75DDD866B9E390f9f668235C3219432EAa0eE3', // OmnuumSigner
  '99', // MaxSupply
  'ipfs://QmTrfNt151At8XkSxn7GaABhURdHwRDDSX3zbu4f8eikgo/', // coverUri
  '0x6F75DDD866B9E390f9f668235C3219432EAa0eE3', // Project Owner
]);

module.exports = ['0x1FBfb9545B8167d027a2D84590b59f81cA1A2483', data]; // Beacon Address
