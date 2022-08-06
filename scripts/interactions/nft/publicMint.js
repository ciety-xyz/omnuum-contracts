const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { getPayloadWithSignature } = require('../interactionHelpers');
const { payloadTopic } = require('../../../utils/constants');
const { nullCheck, queryEIP1559GasFeesAndProceed, getSingleFallbackProvider, consoleBalance } = require('../../deployments/deployHelper');

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
    message: '🤔 nft contract [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.senderVerifierAddress,
    type: 'input',
    message: '🤔 senderVerifier contract [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.minterAddress,
    type: 'input',
    message: '🤔 Minter [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.minterPrivateKey,
    type: 'input',
    message: '🤔 Minter [ PRIVATE KEY ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.groupId,
    type: 'input',
    message: '🤔 Public schedule [ GROUP ID ] is...(uint: dec)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.OmSignatureSignerPrivateKey,
    type: 'input',
    message: '🤔 Signature Signer [ PRIVATE KEY ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.publicPrice,
    type: 'input',
    message: '🤔 [ Mint Price ] at public is...(must be greater or equal to public base price) (unit: ETH)',
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
      const minterSigner = new ethers.Wallet(ans.minterPrivateKey, provider);
      const nftContract = (await ethers.getContractFactory('OmnuumNFT721')).attach(ans.nftContractAddress);

      // Todo: nested mapping data retrieve
      // await nftContract.publicMintSchedules();

      await consoleBalance(minterSigner.address);
      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryEIP1559GasFeesAndProceed();
      if (!proceed) {
        throw new Error('🚨 Transaction Aborted!');
      }

      const payload = await getPayloadWithSignature({
        senderVerifierAddress: ans.senderVerifierAddress,
        minterAddress: ans.minterAddress,
        payloadTopic: payloadTopic.mint,
        groupId: ans.groupId,
        signerPrivateKey: ans.OmSignatureSignerPrivateKey,
      });

      const sendValue = ethers.utils.parseEther(ans.publicPrice).mul(Number(ans.mintQuantity));

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
