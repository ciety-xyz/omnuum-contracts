const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');
const { queryGasDataAndProceed } = require('../../gas/queryGas');

const inquirerParams = {
  nft_contract_address: 'nft_contract_address',
  nft_project_owner_pk: 'nft_project_owner_pk',
  to: 'to',
  send_value: 'send_value',
};

const questions = [
  {
    name: inquirerParams.nft_contract_address,
    type: 'input',
    message: '🤔 NFT contract address is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_project_owner_pk,
    type: 'input',
    message: '🤔 NFT Project Owner private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.to,
    type: 'input',
    message: '🤔 Receiver address is...',
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
      const provider = await getRPCProvider();

      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryGasDataAndProceed();
      if (!proceed) {
        console.log('Transaction Aborted!');
        return;
      }

      const nftProjectOwnerSigner = new ethers.Wallet(ans.nft_project_owner_pk, provider);
      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nft_contract_address);

      const tx = await nftContract
        .connect(nftProjectOwnerSigner)
        .transferBalance(ethers.utils.parseEther(ans.send_value), ans.to, { maxFeePerGas, maxPriorityFeePerGas });

      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Balance is transferred to ${ans.to}. \nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
