const { ethers } = require('hardhat');
const inquirer = require('inquirer');
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

      const inputs = {
        from: await nftOwnerSigner.getAddress(),
        to: ans.receiverAddress,
        id: Number(ans.tokenId),
        amount: 1,
        data: 0x0,
      };

      const nftContract = new ethers.Contract(
        ans.nftContractAddress,
        ['function safeTransferFrom(address, address, uint256, uint256, bytes memory)'],
        nftOwnerSigner,
      );

      const txResponse = await nftContract.connect(nftOwnerSigner).safeTransferFrom(...Object.values(inputs));

      console.log('txRseponse', txResponse);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(
        `💋 SafeTransfer of Token ${ans.tokenId} from Collection ${ans.nftContractAddress} is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`,
      );
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
