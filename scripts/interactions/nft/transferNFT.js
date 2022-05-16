const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');
// method: safeTransferFrom
// signature: safeTransferFrom(
//         address from,
//         address to,
//         uint256 id,
//         uint256 amount,
//         bytes memory data
//     )
//  emit TransferSingle(operator, from, to, id, amount);
// from
// to
// tokenId
// amount = 1
// date = ""

// test
// nft_contract: 0x681d4eeadaa2817715704ba7e28b3640a1fb626d
// from private key : 13383353df61dad1bd645eefd49548e22153423055c7b0089a8ab772077ffda2 (TESTER_E)
// to address : 0xF891E5556686b588269762d59466451FD7cE49B9
// token_id : 1

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

      const txResponseApprove = await nftContract.approve(ans.receiverAddress, ans.tokenId);
      const txReceiptApprove = await txResponseApprove.wait();

      // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
      const { approved } = nftContract.interface.parseLog(txReceiptApprove.events[0]).args;

      if (approved === ans.receiverAddress) {
        console.log(`\n${chalk.yellow(`Token id ${ans.tokenId} is ${chalk.redBright('approved')} to receiver ${approved}`)}\n`);
        const { tokenTrasnfer } = await inquirer.prompt([
          {
            name: 'tokenTrasnfer',
            type: 'list',
            message: '🤔 Choose transfer method?',
            choices: ['safeTrasnferFrom', 'transferFrom', 'cancel'],
          },
        ]);
        if (tokenTrasnfer !== 'cancel') {
          let txResponseSafeTransfer;
          const transferArguments = [nftOwnerSigner.address, ans.receiverAddress, ans.tokenId];
          if (tokenTrasnfer === 'safeTrasnferFrom') {
            txResponseSafeTransfer = await nftContract['safeTransferFrom(address,address,uint256)'](...transferArguments);
          } else if (tokenTrasnfer === 'transferFrom') {
            txResponseSafeTransfer = await nftContract.transferFrom(...transferArguments);
          }

          const txReceiptSafeTransfer = await txResponseSafeTransfer.wait();

          // event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
          // event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
          const { to } = nftContract.interface.parseLog(txReceiptSafeTransfer.events[1]).args;
          if (to === ans.receiverAddress) {
            console.log(`\n${chalk.yellow(`Token id ${ans.tokenId} is ${chalk.redBright('safe transferred')} to receiver ${approved}`)}\n`);
            console.log(
              `💋 Token ${ans.tokenId} from nftContract ${ans.nftContractAddress} is ${chalk.redBright(
                'safe transferred',
              )} to receiver ${approved}.\nBlock: ${txReceiptSafeTransfer.blockNumber}\nTransaction: ${
                txReceiptSafeTransfer.transactionHash
              }`,
            );
          } else {
            throw new Error('Wrong receiver');
          }
        }
      }
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
