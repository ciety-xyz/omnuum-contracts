const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, queryEIP1559GasFeesAndProceed, getSingleFallbackProvider, consoleBalance } = require('../../deployments/deployHelper');
const { testValues } = require('../../../utils/constants');

const inquirerParams = {
  nftOwnerPrivateKey: 'nftOwnerPrivateKey',
  nftAddress: 'nftAddress',
  mintManagerAddress: 'mintManagerAddress',
  airDropReveiver: 'airDropReveiver',
  airDropQty: 'airDropQty',
  isJustEstimateGas: 'isJustEstimateGas',
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
    name: inquirerParams.airDropReveiver,
    type: 'input',
    message: '🤔 Airdrop receiver [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airDropQty,
    type: 'input',
    message: '🤔 Airdrop [ QUANTITY ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.isJustEstimateGas,
    type: 'confirm',
    message: '🤔 Just [ ESTIMATE GAS ]... ?',
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

      const value = testValues.minFee.mul(Number(ans.airDropQty));
      const args = [ans.nftAddress, [ans.airDropReveiver], [ans.airDropQty], { value, maxFeePerGas, maxPriorityFeePerGas }];

      if (ans.isJustEstimateGas) {
        const gas = await mintManager.connect(nftOwnerSigner).estimateGas.mintMultiple(...args);
        console.log(`Gas Estimation: ${gas}`);
        return;
      }

      const tx = await mintManager.connect(nftOwnerSigner).mintMultiple(...args);
      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();
      console.log(txReceipt);
      console.log(`💋 Air drop is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
