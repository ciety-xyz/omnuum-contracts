const { ethers } = require('hardhat');

const iFace = new ethers.utils.Interface(['function initialize(address,address,uint32,string,address) public']);

const data = iFace.encodeFunctionData(iFace.getFunction('initialize'), [
  '0xd52f874978c3b86ef4a8dc5e03adaa4f3c81b8ab', // caManager
  '0x81876853baef4001B844B11dF010E9647b7c9a2b', // OmnuumSigner
  '50', // MaxSupply
  'ipfs://bafybeih7kkcqf4vygtiniptftvtcbucycacogplvolf53pxioirgkf4oci/707-90348/{id}.json', // coverUri
  '0x8a54aabcccf6299f138ff3cabe6f637716449eb4', // Project Owner
]);

module.exports = ['0x25a374f03B20ba168F723630cc1850A8D1A9767a', data]; // Beacon Address
