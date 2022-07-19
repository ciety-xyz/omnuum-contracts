const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const chalk = require('chalk');
const {
  nullCheck,
  getRPCProvider,
  getSingleFallbackProvider,
  consoleBalance,
  queryEIP1559GasFeesAndProceed,
  set1559FeeDataToProvider,
} = require('../../deployments/deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  mintManagerAddress: 'mintManagerAddress',
  minFee: 'minFee',
};

const questions = [
  {
    name: inquirerParams.devDeployerPrivateKey,
    type: 'input',
    message: '🤔 Deployer [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.mintManagerAddress,
    type: 'input',
    message: '🤔 MintManager contract [ ADDRESS ]  is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.minFee,
    type: 'input',
    message: '🤔 new [ MIN FEE ] value is... (in ether)',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getSingleFallbackProvider();
      const deployer = new ethers.Wallet(ans.devDeployerPrivateKey, provider);

      await consoleBalance(deployer.address);
      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryEIP1559GasFeesAndProceed();
      if (!proceed) {
        throw new Error('🚨 Transaction Aborted!');
      }

      set1559FeeDataToProvider(deployer.provider, maxFeePerGas, maxPriorityFeePerGas);

      const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mintManagerAddress);

      const currentMinFee = ethers.utils.formatEther(await mintManager.minFee());

      const { confirm } = await inquirer.prompt([
        {
          name: 'confirm',
          type: 'confirm',
          message: chalk.redBright(`\n  Current min Fee: ${currentMinFee} ether => Change to: ${ans.minFee} ether.\n  Want to Proceed ?`),
        },
      ]);

      if (!confirm) {
        throw new Error('Aborted!');
      }

      const tx = await mintManager.connect(deployer).setMinFee(ethers.utils.parseEther(ans.minFee));
      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();
      console.log(txReceipt);
      console.log(`💋 Minimum Fee is Updated..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
