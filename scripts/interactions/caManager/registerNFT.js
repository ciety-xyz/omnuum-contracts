const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { getRPCProvider, nullCheck } = require('../../deployments/deployHelper');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
  ca_manager_address: 'ca_manager_address',
  tobe_register_nft_Address: 'tobe_register_nft_Address',
  nft_project_owner: 'nft_project_owner',
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
    name: inquirerParams.tobe_register_nft_Address,
    type: 'input',
    message: '🤔 New NFT address you want to register...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_project_owner,
    type: 'input',
    message: '🤔 NFT project owner address is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider();
      const devDeployerSigner = new ethers.Wallet(ans.dev_deployer_private_key, provider);

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.ca_manager_address);

      const txResponse = await caManager
        .connect(devDeployerSigner)
        .registerNftContract(ans.tobe_register_nft_Address, ans.nft_project_owner);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 NFT Contract is registered..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
