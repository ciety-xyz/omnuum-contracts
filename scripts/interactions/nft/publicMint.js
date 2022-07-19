const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { getPayloadWithSignature } = require('../interactionHelpers');
const { payloadTopic } = require('../../../utils/constants');
const { nullCheck, queryEIP1559GasFeesAndProceed, getSingleFallbackProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  nftContractAddress: 'nftContractAddress',
  senderVerifierAddress: 'senderVerifierAddress',
  minterAddress: 'minterAddress',
  minterPrivateKey: 'minterPrivateKey',
  groupId: 'groupId',
  OmSignatureSignerPrivateKey: 'OmSignatureSignerPrivateKey',
  publicPrice: 'publicPrice',
  mintQuantity: 'mintQuantity',
};

const questions = [
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 nft contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.senderVerifierAddress,
    type: 'input',
    message: '🤔 senderVerifier contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.minterAddress,
    type: 'input',
    message: '🤔 Minter Address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.minterPrivateKey,
    type: 'input',
    message: '🤔 Minter Private Key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.groupId,
    type: 'input',
    message: '🤔 Public schedule group id is...(uint: dec)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.OmSignatureSignerPrivateKey,
    type: 'input',
    message: '🤔 Omnuum Signature Signer PrivateKey is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.publicPrice,
    type: 'input',
    message: '🤔 Mint Price at public is...(must be greater or equal to public base price) (unit: ETH)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.mintQuantity,
    type: 'input',
    message: '🤔 Mint Quantity is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getSingleFallbackProvider();

      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryEIP1559GasFeesAndProceed();
      if (!proceed) {
        console.log('Transaction Aborted!');
        return;
      }

      const payload = await getPayloadWithSignature({
        senderVerifierAddress: ans.senderVerifierAddress,
        minterAddress: ans.minterAddress,
        payloadTopic: payloadTopic.mint,
        groupId: ans.groupId,
        signerPrivateKey: ans.OmSignatureSignerPrivateKey,
      });

      const sendValue = ethers.utils.parseEther(ans.publicPrice).mul(Number(ans.mintQuantity));

      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress);

      const minterSigner = new ethers.Wallet(ans.minterPrivateKey, provider);

      const tx = await nftContract
        .connect(minterSigner)
        .publicMint(ans.mintQuantity, ans.groupId, payload, { value: sendValue, maxFeePerGas, maxPriorityFeePerGas });

      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });
      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Public mint is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
