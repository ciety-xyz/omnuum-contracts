const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  nftContractAddress: 'nftContractAddress',
  ownerPrivateKey: 'ownerPrivateKey',
};

const questions = [
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 nft contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ownerPrivateKey,
    type: 'input',
    message: '🤔 NFT project owner private key is ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.ownerPrivateKey, provider);

      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress);
      const txResponse = await nftContract.connect(nftOwnerSigner).initFilterRegistryAfterDeploy();
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Init Filter Registry is set.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
