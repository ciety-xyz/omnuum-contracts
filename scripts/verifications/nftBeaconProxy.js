const { ethers } = require('hardhat');

const iFace = new ethers.utils.Interface(['function initialize(address,address,uint32,string,address) public']);

const data = iFace.encodeFunctionData(iFace.getFunction('initialize'), [
  '0x22689146aDdFFE692b21f1b0C74649cF2C18927b', // caManager
  '0x1c99bB58b1ceCB7668ae7FFca5771Fb5d7344f55', // OmnuumSigner
  '1234', // MaxSupply
  'gkg.com', // coverUri
  '0xE8B67856F9f9Fc97b135139759ce575dB19dA5b1', // Project Owner
]);

module.exports = ['0xB23D4c034d74E2f7ce4E39C86016e92E1266545A', data]; // Beacon Address
