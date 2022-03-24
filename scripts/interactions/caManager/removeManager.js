const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { getRPCProvider, nullCheck } = require('../../deployments/deployHelper');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
  ca_manager_address: 'ca_manager_address',
  remove_manager_Address: 'remove_manager_Address',
};

const questions = [
  {
    name: inquirerParams.dev_deployer_private_key,
    type: 'input',
    message: '🤔 Dev deployer private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ca_manager_address,
    type: 'input',
    message: '🤔 CA manager proxy address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.remove_manager_Address,
    type: 'input',
    message: '🤔 Manager address to be removed...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const devDeployerSigner = new ethers.Wallet(ans.dev_deployer_private_key, provider);

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.ca_manager_address);

      const txResponse = await caManager.connect(devDeployerSigner).removeContract(ans.remove_manager_Address);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Manager Contract is removed..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
