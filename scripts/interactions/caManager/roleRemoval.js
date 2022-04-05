const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { getRPCProvider, nullCheck } = require('../../deployments/deployHelper');
const Constants = require('../../../utils/constants');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
  ca_manager_address: 'ca_manager_address',
  role_register_contract_address: 'role_register_contract_address',
  role: 'role',
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
    name: inquirerParams.role_register_contract_address,
    type: 'input',
    message: '🤔 Contract address you want to remove role...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.role,
    type: 'input',
    message: '🤔 Contract role is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const devDeployerSigner = new ethers.Wallet(ans.dev_deployer_private_key, provider);

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.ca_manager_address);

      const txResponse = await caManager.connect(devDeployerSigner).removeRole([ans.role_register_contract_address], ans.role);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Role has been removed.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
