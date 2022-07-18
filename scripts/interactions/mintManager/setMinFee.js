const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const questions = [
  {
    name: 'deployer_private_key',
    type: 'input',
    message: '🤔 MintManager deployer private key is ...',
    validate: nullCheck,
  },
  {
    name: 'mint_manager_address',
    type: 'input',
    message: '🤔 MintManager contract address is ...',
    validate: nullCheck,
  },
  {
    name: 'minFee',
    type: 'input',
    message: '🤔 MinFee value ... (in ether)',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider();
      const deployerSigner = new ethers.Wallet(ans.deployer_private_key, provider);
      const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mint_manager_address);

      const txResponse = await mintManager.connect(deployerSigner).setMinFee(ethers.utils.parseEther(ans.minFee));

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);

      console.log(`\n\nUpdated minFee: ${await mintManager.minFee()}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
