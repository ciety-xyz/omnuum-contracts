const { ethers } = require('hardhat');

const iFace = new ethers.utils.Interface(['function initialize(address,address,uint32,string,address,string,string) public']);

const data = iFace.encodeFunctionData(iFace.getFunction('initialize'), [
  '0xd52f874978c3b86ef4a8dc5e03adaa4f3c81b8ab', // caManager
  '0x81876853baef4001B844B11dF010E9647b7c9a2b', // OmnuumSigner
  '10000', // MaxSupply
  'ipfs://bafybeih7i4lr33v6sd72m5veqg44g2be7pwm4rxk4m2c4py7dccs6a72va/792-38774/', // coverUri
  '0x79c4253608a06e1864ac25236803e0b648719880', // Project Owner
  'BODY',
  'SYMBOL',
]);

module.exports = ['0xd4d7fd222ccc3b574cd6ca7df632df1db09ad388', data]; // Beacon Address
