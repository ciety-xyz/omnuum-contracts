const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  nftContractAddress: 'nftContractAddress',
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  base_uri: 'base_uri',
};

const questions = [
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 nft contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_owner_private_key,
    type: 'input',
    message: '🤔 NFT project owner private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.base_uri,
    type: 'input',
    message: '🤔 Base Uri to be changed is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider();

      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryGasDataA«ndProceed();
      if (!proceed) {
        console.log('Transaction Aborted!');
        return;
      }

      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);

      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress);
      const txResponse = await nftContract.connect(nftOwnerSigner).changeBaseURI(ans.base_uri, { maxFeePerGas, maxPriorityFeePerGas });

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Base uri is changed.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
