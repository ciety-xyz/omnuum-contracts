const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { getRPCProvider, nullCheck } = require('../../deployments/deployHelper');

const inquirerParams = {
  nft_owner_private_key: 'nft_owner_private_key',
  ca_manager_address: 'ca_manager_address',
  tobe_register_Address: 'tobe_register_Address',
  topic: 'topic',
};

const questions = [
  {
    name: inquirerParams.nft_owner_private_key,
    type: 'input',
    message: '🤔 NFT project owners private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ca_manager_address,
    type: 'input',
    message: '🤔 CA manager address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.tobe_register_Address,
    type: 'input',
    message: '🤔 New address you want to register...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.topic,
    type: 'input',
    message: '🤔 Contract topic is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.ca_manager_address);

      const txResponse = await caManager.connect(nftOwnerSigner).registerContract(ans.tobe_register_Address, ans.topic);

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Contract is registered..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
