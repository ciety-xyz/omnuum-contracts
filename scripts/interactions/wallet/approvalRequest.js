const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  requester_private_key: 'requester_private_key',
  wallet_address: 'wallet_address',
  withdrawal_value: 'withdrawal_value',
};

const questions = [
  {
    name: inquirerParams.requester_private_key,
    type: 'input',
    message: '🤔 Requester private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.wallet_address,
    type: 'input',
    message: '🤔 Wallet contract address is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.withdrawal_value,
    type: 'input',
    message: '🤔 How much money do you want to withdrawal is ... (unit: ETH)',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const requesterSigner = new ethers.Wallet(ans.requester_private_key, provider);

      const wallet = (await ethers.getContractFactory('OmnuumWallet')).attach(ans.wallet_address);

      const txResponse = await wallet
        .connect(requesterSigner)
        .approvalRequest(ethers.utils.parseEther(ans.withdrawal_value), { gasLimit: 10000000 });
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Approval request is on the way..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
