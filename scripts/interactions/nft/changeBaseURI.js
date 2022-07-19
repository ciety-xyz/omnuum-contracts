const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const chalk = require('chalk');
const {
  nullCheck,
  getRPCProvider,
  getSingleFallbackProvider,
  consoleBalance,
  queryEIP1559GasFeesAndProceed,
} = require('../../deployments/deployHelper');

const inquirerParams = {
  nftContractAddress: 'nftContractAddress',
  nftOwnerPrivateKey: 'nftOwnerPrivateKey',
  baseUri: 'baseUri',
};

const questions = [
  {
    name: inquirerParams.nftOwnerPrivateKey,
    type: 'input',
    message: '🤔 NFT project owner [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 nft contract [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.baseUri,
    type: 'input',
    message: '🤔 new [ BASE URI ] to be changed is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getSingleFallbackProvider();
      const nftOwnerSigner = new ethers.Wallet(ans.nftOwnerPrivateKey, provider);

      await consoleBalance(nftOwnerSigner.address);
      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryEIP1559GasFeesAndProceed();
      if (!proceed) {
        throw new Error('🚨 Transaction Aborted!');
      }

      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress);

      const currentBaseUri = await nftContract.baseURI();

      const { confirm } = await inquirer.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          message: chalk.redBright(`\n  Current base Uri: ${currentBaseUri} => Change to: ${ans.baseUri}\n  Want to Proceed ?`),
        },
      ]);

      if (!confirm) {
        throw new Error('Aborted!');
      }

      const tx = await nftContract.connect(nftOwnerSigner).changeBaseURI(ans.baseUri, { maxFeePerGas, maxPriorityFeePerGas });
      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Base uri is changed.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
