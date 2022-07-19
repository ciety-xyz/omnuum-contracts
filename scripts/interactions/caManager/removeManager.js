const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const {
  getRPCProvider,
  nullCheck,
  getSingleFallbackProvider,
  consoleBalance,
  queryEIP1559GasFeesAndProceed,
  set1559FeeDataToProvider,
} = require('../../deployments/deployHelper');

const inquirerParams = {
  devDeployerPrivateKey: 'devDeployerPrivateKey',
  caManagerAddress: 'caManagerAddress',
  removeManagerAddress: 'removeManagerAddress',
};

const questions = [
  {
    name: inquirerParams.devDeployerPrivateKey,
    type: 'input',
    message: '🤔 Deployer [ PRIVATE KEY ] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.caManagerAddress,
    type: 'input',
    message: '🤔 CA Manager [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.removeManagerAddress,
    type: 'input',
    message: '🤔 Manager address to be removed...',
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

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.caManagerAddress);

      const tx = await caManager.connect(deployer).removeContract(ans.removeManagerAddress);

      console.log('🔑 Transaction');
      console.dir(tx, { depth: 10 });
      const txReceipt = await tx.wait();

      console.log(txReceipt);
      console.log(`💋 Manager Contract is removed..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
