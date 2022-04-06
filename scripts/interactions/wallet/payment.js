const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  wallet_address: 'wallet_address',
  ether_sender_private_key: 'ether_sender_private_key',
  payment_value: 'payment_value',
  payment_topic: 'payment_topic',
  payment_description: 'payment_description',
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
    name: inquirerParams.payment_value,
    type: 'input',
    message: '🤔 Amount of payment is (in ether)...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.payment_topic,
    type: 'input',
    message: '🤔 What is payment topic?',
    validate: nullCheck,
  },
  {
    name: inquirerParams.payment_description,
    type: 'input',
    message: '🤔 What is payment description?',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const senderSigner = new ethers.Wallet(ans.ether_sender_private_key, provider);
      const wallet = (await ethers.getContractFactory('OmnuumWallet')).attach(ans.wallet_address);
      const txResponse = await wallet
        .connect(senderSigner)
        .makePayment(ans.payment_topic, ans.payment_description, { value: ethers.utils.parseEther(ans.payment_value) });

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Pay to Wallet. \nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
