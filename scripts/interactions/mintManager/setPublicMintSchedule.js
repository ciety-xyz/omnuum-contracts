const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { addHours } = require('date-fns');
const { nullCheck, queryEIP1559GasFeesAndProceed, getSingleFallbackProvider, consoleBalance } = require('../../deployments/deployHelper');
const { toSolDate } = require('../../../test/etc/util.js');

const inquirerParams = {
  nftOwnerPrivateKey: 'nftOwnerPrivateKey',
  nftAddress: 'nftAddress',
  mintManagerAddress: 'mintManagerAddress',
  groupId: 'groupId',
  endDayFromNow: 'endDayFromNow',
  basePrice: 'basePrice',
  supply: 'supply',
  maxMintAtAddress: 'maxMintAtAddress',
};

const questions = [
  {
    name: inquirerParams.nftOwnerPrivateKey,
    type: 'input',
    message: '🤔 NFT project owner [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nftAddress,
    type: 'input',
    message: '🤔 NFT contract [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.mintManagerAddress,
    type: 'input',
    message: '🤔 Mint manager [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.groupId,
    type: 'input',
    message: '🤔 Public schedule [ GROUP ID ] is set to be...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.endDayFromNow,
    type: 'input',
    message: '🤔 Schedule [ PERIOD ] is... (unit: hr)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.basePrice,
    type: 'input',
    message: '🤔 [ BASE PRICE ] is... (unit: ether)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.supply,
    type: 'input',
    message: '🤔 How much supply...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.maxMintAtAddress,
    type: 'input',
    message: '🤔 [Max Mint Quantity Per Address] is ...',
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

      const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mintManagerAddress);

      const tx = await mintManager
        .connect(nftOwnerSigner)
        .setPublicMintSchedule(
          ans.nftAddress,
          ans.groupId,
          toSolDate(addHours(new Date(), Number(ans.endDayFromNow))),
          ethers.utils.parseEther(ans.basePrice),
          Number(ans.supply),
          Number(ans.maxMintAtAddress),
          { maxFeePerGas, maxPriorityFeePerGas },
        );

      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Mint schedule is set..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
