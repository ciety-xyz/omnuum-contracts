const { ethers } = require('hardhat');
const inquirer = require('inquirer');
const { getTicketWithSignature, getPayloadWithSignature } = require('../interactionHelpers');
const { payloadTopic } = require('../../../utils/constants');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

require('dotenv').config();

const inquirerParams = {
  ticketManagerAddress: 'ticketManagerAddress',
  nftContractAddress: 'nftContractAddress',
  senderVerifierAddress: 'senderVerifierAddress',
  minterAddress: 'minterAddress',
  minterPrivateKey: 'minterPrivateKey',
  groupId: 'groupId',
  OmSignerPrivateKey: 'OmSignerPrivateKey',
  ticketPrice: 'ticketPrice',
  ticketQuantity: 'ticketQuantity',
  mintQuantity: 'mintQuantity',
};

const questions = [
  {
    name: inquirerParams.ticketManagerAddress,
    type: 'input',
    message: '🤔 Ticket Manager Address is ...',
    validate: nullCheck,
  },
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
    message: '🤔 Ticket schedule group id is...(uint: dec)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.OmSignerPrivateKey,
    type: 'input',
    message: '🤔 Omnuum Dev Deployer Signer PrivateKey is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ticketPrice,
    type: 'input',
    message: '🤔 Mint Price of ticket is...(unit: ETH)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ticketQuantity,
    type: 'input',
    message: '🤔 Ticket Quantity is...',
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
      const provider = await getRPCProvider(ethers.provider);

      const ticket = await getTicketWithSignature({
        ticketManagerAddress: ans.ticketManagerAddress,
        minterAddress: ans.minterAddress,
        nftContractAddress: ans.nftContractAddress,
        groupId: ans.groupId,
        ether_price: ans.ticketPrice,
        quantity: ans.ticketQuantity,
        signerPrivateKey: ans.OmSignerPrivateKey,
      });

      const payload = await getPayloadWithSignature({
        senderVerifierAddress: ans.senderVerifierAddress,
        minterAddress: ans.minterAddress,
        payloadTopic: payloadTopic.ticket,
        groupId: ans.groupId,
        signerPrivateKey: ans.OmSignerPrivateKey,
      });

      const sendValue = ethers.utils.parseEther(ans.ticketPrice).mul(Number(ans.mintQuantity));

      const nftContract = (await ethers.getContractFactory('OmnuumNFT1155')).attach(ans.nftContractAddress);

      const minterSigner = new ethers.Wallet(ans.minterPrivateKey, provider);
      const txResponse = await nftContract
        .connect(minterSigner)
        .ticketMint(ans.mintQuantity, ticket, payload, { value: sendValue, gasLimit: 10000000 });
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Ticket Mint is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
