const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  nftContractAddress: 'nftContractAddress',
  nftOwnerPrivateKey: 'nftOwnerPrivateKey',
  receiverAddress: 'receiverAddress',
  tokenId: 'tokenId',
};
const questions = [
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 nft contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nftOwnerPrivateKey,
    type: 'input',
    message: '🤔 NFT owner private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.receiverAddress,
    type: 'input',
    message: '🤔 Who address do you want transfer is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.tokenId,
    type: 'input',
    message: '🤔 Token id you want to transfer is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nftOwnerPrivateKey, provider);

      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress).connect(nftOwnerSigner);

      const { wantToApprove } = inquirer.prompt({
        name: 'wantToApprove',
        type: 'confirm',
        message: '🤔 Want to approve?',
      });

      if (wantToApprove) {
        const txResponseApprove = await nftContract.approve(ans.receiverAddress, ans.tokenId);
        const txReceiptApprove = await txResponseApprove.wait();
        // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
        const { approved } = nftContract.interface.parseLog(txReceiptApprove.events[0]).args;
        console.log(`\n${chalk.yellow(`Token id ${ans.tokenId} is ${chalk.redBright('approved')} to receiver ${approved}`)}\n`);
      }

      const { tokenTrasnfer } = await inquirer.prompt([
        {
          name: 'tokenTrasnfer',
          type: 'list',
          message: '🤔 Choose transfer method?',
          choices: ['safeTransferFrom', 'transferFrom', 'cancel'],
        },
      ]);
      if (tokenTrasnfer !== 'cancel') {
        let txResponseSafeTransfer;
        const transferArguments = [nftOwnerSigner.address, ans.receiverAddress, ans.tokenId];
        if (tokenTrasnfer === 'safeTransferFrom') {
          txResponseSafeTransfer = await nftContract['safeTransferFrom(address,address,uint256)'](...transferArguments);
        } else if (tokenTrasnfer === 'transferFrom') {
          txResponseSafeTransfer = await nftContract.transferFrom(...transferArguments);
        }

        const txReceiptSafeTransfer = await txResponseSafeTransfer.wait();

        console.log(txReceiptSafeTransfer.events);

        // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
        // event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
        const { to } = nftContract.interface.parseLog(txReceiptSafeTransfer.events[1]).args;
        console.log(to, ans.receiverAddress);
        if (to.toLowerCase() === ans.receiverAddress.toLowerCase()) {
          console.log(
            `\n${chalk.yellow(`Token id ${ans.tokenId} is ${chalk.redBright('safe transferred')} to receiver ${ans.receiverAddress}`)}\n`,
          );
          console.log(
            `💋 Token ${ans.tokenId} from nftContract ${ans.nftContractAddress} is ${chalk.redBright('safe transferred')} to receiver ${
              ans.receiverAddress
            }.\nBlock: ${txReceiptSafeTransfer.blockNumber}\nTransaction: ${txReceiptSafeTransfer.transactionHash}`,
          );
        } else {
          throw new Error('Wrong receiver');
        }
      }
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
