const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, getRPCProvider } = require('../../deployHelper');
const { testValues } = require('../../../../utils/constants');

const inquirerParams = {
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  mint_manager_address: 'mint_manager_address',
  airdrop_receiver_A: 'airdrop_receiver_A',
  quantity_to_A: 'quantity_to_A',
  airdrop_receiver_B: 'airdrop_receiver_B',
  quantity_to_B: 'quantity_to_B',
};

const questions = [
  {
    name: inquirerParams.nft_owner_private_key,
    type: 'input',
    message: '🤔 NFT project owner private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_address,
    type: 'input',
    message: '🤔 NFT contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.mint_manager_address,
    type: 'input',
    message: '🤔 Mint manager address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airdrop_receiver_A,
    type: 'input',
    message: '🤔 Airdrop receiver address A is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.quantity_to_A,
    type: 'input',
    message: '🤔 How many nfts airdrop to receiver A is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airdrop_receiver_B,
    type: 'input',
    message: '🤔 Airdrop receiver address B is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.quantity_to_B,
    type: 'input',
    message: '🤔 How many nfts airdrop to receiver B is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);
      const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mint_manager_address);

      const value = testValues.minFee.mul(Number(ans.quantity_to_A) + Number(ans.quantity_to_B));
      const txResponse = await mintManager
        .connect(nftOwnerSigner)
        .mintMultiple(ans.nft_address, [ans.airdrop_receiver_A, ans.airdrop_receiver_B], [ans.quantity_to_A, ans.quantity_to_B], { value });

      console.log('txRseponse', txResponse);

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`☀️ Air drop is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
