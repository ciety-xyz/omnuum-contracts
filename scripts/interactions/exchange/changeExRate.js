const { ethers } = require('hardhat');
const inquirer = require('inquirer');

const {
  nullCheck,
  getSingleFallbackProvider,
  consoleBalance,
  queryEIP1559GasFeesAndProceed,
  set1559FeeDataToProvider,
} = require('../../deployments/deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  exchangeAddress: 'exchangeAddress',
  newExchangeRate: 'newExchangeRate',
  topic: 'topic',
};

const questions = [
  {
    name: inquirerParams.devDeployerPrivateKey,
    type: 'input',
    message: '🤔 Deployer [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.exchangeAddress,
    type: 'input',
    message: '🤔 Exchange [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.newExchangeRate,
    type: 'input',
    message: '🤔 New [ EXCHANGERATE ] (in ether) is...',
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

      const exchange = (await ethers.getContractFactory('OmnuumExchange')).attach(ans.exchangeAddress);

      const tx = await exchange.connect(deployer).updateTmpExchangeRate(ethers.utils.parseEther(ans.newExchangeRate));

      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });

      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Manager Contract is registered..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
