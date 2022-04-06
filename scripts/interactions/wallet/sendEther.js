const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  wallet_address: 'wallet_address',
  ether_sender_private_key: 'ether_sender_private_key',
  send_value: 'send_value',
};

const questions = [
  {
    name: inquirerParams.wallet_address,
    type: 'input',
    message: '🤔 Wallet contract address is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ether_sender_private_key,
    type: 'input',
    message: '🤔 Ether sender private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.send_value,
    type: 'input',
    message: '🤔 Amount of Ether you want to send is (in ether)...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const senderSigner = new ethers.Wallet(ans.ether_sender_private_key, provider);

      const txResponse = await senderSigner.sendTransaction({
        to: ans.wallet_address,
        value: ethers.utils.parseEther(ans.send_value),
      });
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Send ether to Wallet. \nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
