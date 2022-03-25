const { ethers, upgrades } = require('hardhat');
const { writeFile, readFile } = require('fs/promises');

async function main() {
  // 1. deploy
  async function deploy() {
    const OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');
    const omnuumMintManager = await upgrades.deployProxy(OmnuumMintManager, []);
    await omnuumMintManager.deployed();
    console.log('omnuumMintManager deployed to:', omnuumMintManager.address);

    await writeFile('./deployed.json', JSON.stringify({ omnuumMintManagerAddress: omnuumMintManager.address }));
  }

  // 2. update proxy
  async function update() {
    const { omnuumMintManagerAddress } = JSON.parse(await readFile('./deployed.json', 'utf8'));

    const OmnuumMintManager = await ethers.getContractFactory('OmnuumMintManager');

    await upgrades.upgradeProxy(omnuumMintManagerAddress, OmnuumMintManager);
    console.log('OmnuumMintManager upgraded');
  }

  // 3. etc test deploy
  async function singleDeploy() {
    const SenderVerifier = await ethers.getContractFactory('OmnuumMintManager');
    const senderVerifier = await OmnuumMintManager.deploy();
    console.log(`SenderVerifier: ${senderVerifier.address}`);

    await writeFile('./deployed.json', JSON.stringify({ senderVerifier: senderVerifier.address }));
  }

  // await deploy();
  await update();
  // await singleDeploy();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
