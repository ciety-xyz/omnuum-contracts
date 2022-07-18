const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  approver_private_key: 'approver_private_key',
  wallet_address: 'wallet_address',
  request_id: 'request_id',
};

const questions = [
  {
    name: inquirerParams.approver_private_key,
    type: 'input',
    message: '🤔 Approver private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.wallet_address,
    type: 'input',
    message: '🤔 Wallet contract address is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.request_id,
    type: 'input',
    message: '🤔 Request id you want to revoke ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider();
      const approverSigner = new ethers.Wallet(ans.approver_private_key, provider);

      const wallet = (await ethers.getContractFactory('OmnuumWallet')).attach(ans.wallet_address);

      const txResponse = await wallet.connect(approverSigner).revokeApproval(ans.request_id, { gasLimit: 10000000 });
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Revoke is on the way..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
