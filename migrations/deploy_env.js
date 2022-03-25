const { ethers, upgrades } = require('hardhat');
const { updateJSON } = require('../src/util.js');

module.exports = async function (deployer, network, accounts) {
  const OmnuumCAManager = await ethers.getContractFactory('OmnuumCAManager');
  const SenderVerifier = await ethers.getContractFactory('SenderVerifier');
  const OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');
  const OmnuumNFT1155 = await ethers.getContractFactory('OmnuumNFT1155');
  const OmnuumNFT721 = await ethers.getContractFactory('OmnuumNFT721');

  const omnuumCAManager = await upgrades.deployProxy(OmnuumCAManager, []);
  await omnuumCAManager.deployed();

  //

  await SenderVerifier.deploy();
  const omnuumMintManager = await deployProxy(OmnuumMintManager);

  const beacon1155 = await deployBeacon(OmnuumNFT1155);
  const beacon721 = await deployBeacon(OmnuumNFT721);

  console.log(`[Complete] Deploy Beacon: 1155: ${beacon1155.address}, 721: ${beacon721.address}`);

  await updateJSON('./deployed.json', {
    senderVerifier: (await SenderVerifier.deployed()).address,
    omnuumMintManager: omnuumMintManager.address,
    beacon1155: beacon1155.address,
    beacon721: beacon721.address,
  });
};
