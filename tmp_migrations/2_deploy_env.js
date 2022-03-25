const { deployProxy, deployBeacon } = require('@openzeppelin/truffle-upgrades');
const { updateJSON } = require('../src/util.js');

const SenderVerifier = artifacts.require('SenderVerifier');
const OmnuumMintManager = artifacts.require('OmnuumMintManager');
const OmnuumNFT1155 = artifacts.require('OmnuumNFT1155');
const OmnuumNFT721 = artifacts.require('OmnuumNFT721');

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(SenderVerifier);
  const omnuumMintManager = await deployProxy(OmnuumMintManager);

  const beacon1155 = await deployBeacon(OmnuumNFT1155);
  const beacon721 = await deployBeacon(OmnuumNFT721);

  console.log(
    `[Complete] Deploy Beacon: 1155: ${beacon1155.address}, 721: ${beacon721.address}`,
  );

  await updateJSON('./deployed.json', {
    senderVerifier: (await SenderVerifier.deployed()).address,
    omnuumMintManager: omnuumMintManager.address,
    beacon1155: beacon1155.address,
    beacon721: beacon721.address,
  });
};
