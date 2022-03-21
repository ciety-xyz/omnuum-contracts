const { ethers, upgrades } = require('hardhat');
const inquirer = require('inquirer');
const { getTicketWithSignature, getPayloadWithSignature } = require('../interactionHelpers');
const { payloadTopic } = require('../../../../utils/constants');
const { nullCheck, getRPCProvider } = require('../../deployHelper');

const nftAbi = require('../../../../data/abi/OmnuumNFT1155.json');
const { createTicket, signPayload } = require('../../../../test/etc/util');
const Constants = require('../../../../utils/constants');

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
    message: '🤔 Ticket schedule group id is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.OmSignerPrivateKey,
    type: 'input',
    message: '🤔 Omnuum Signer PrivateKey is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ticketPrice,
    type: 'input',
    message: '🤔 Mint Price is...(unit: ETH)',
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

    console.log('Ticket Mint is on the way.');
    console.log(txReceipt);
  });
})();

/* cli input params:
 *
 * ticketManager: 0xaA8F8Eb882927d0287F36038CEa10d6A1F005B3e
 * nft contract addr: 0x1Cceb341f8949B9d4744C6f08cc16d9AC061D077
 * sender verifier addr: 0x260bcd91923e97EdA6E8148A2ba5835A19c46d1f
 * minter address: 0x0C0ff011A2bF707d28BCBE0893045485B1D1ad27
 * minter pk : 13383353df61dad1bd645eefd49548e22153423055c7b0089a8ab772077ffda2
 * schedule: 32
 * c054d97e31e27eb2b9ecb23c50ca886ae6793eb4d494f286b35efb6aa38cb6e3
 * 0.0001
 * 10
 * 4
 *
 * */
