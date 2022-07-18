const inquirer = require('inquirer');
const { ethers } = require('hardhat');

const chalk = require('chalk');
const { nullCheck, getRPCProvider, getChainName, queryGasDataAndProceed } = require('../../deployments/deployHelper');
const DEP_CONSTANTS = require('../../deployments/deployConstants');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  reveal_manager_address: 'reveal_manager_address',
  vrf_manager_address: 'vrf_manager_address',
  exchange_manager_address: 'exchange_manager_address',
};

const questions = [
  {
    name: inquirerParams.dev_deployer_private_key,
    type: 'input',
    message: '🤔 Dev deployer private key is ...',
    validate: nullCheck,
  },
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
    name: inquirerParams.exchange_manager_address,
    type: 'input',
    message: '🤔 Exchange manager address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.reveal_manager_address,
    type: 'input',
    message: '🤔 Reveal manager address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.vrf_manager_address,
    type: 'input',
    message: '🤔 VRF manager address is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const chainName = await getChainName();
      const provider = await getRPCProvider();
      const chainlinkData = DEP_CONSTANTS.vrfManager.chainlink[chainName];
      const devDeployerSigner = new ethers.Wallet(ans.dev_deployer_private_key, provider);

      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);
      const revealManager = (await ethers.getContractFactory('RevealManager')).attach(ans.reveal_manager_address);
      const vrfManager = (await ethers.getContractFactory('OmnuumVRFManager')).attach(ans.vrf_manager_address);

      const requiredLinkFee = chainlinkData.fee;

      const { sendLink } = await inquirer.prompt([
        {
          name: 'sendLink',
          type: 'confirm',
          message: `${chalk.yellowBright(`🤔 Do you want to send ${requiredLinkFee} LINK to exchange manager contract?`)}`,
        },
      ]);
      let maxFeePerGas;
      let maxPriorityFeePerGas;
      let proceed;

      if (sendLink) {
        const response = await queryGasDataAndProceed();
        maxFeePerGas = response.maxFeePerGas;
        maxPriorityFeePerGas = response.maxPriorityFeePerGas;
        proceed = response.proceed;
        if (!proceed) {
          console.log('Transaction Aborted!');
          return;
        }
        const linkContract = new ethers.Contract(
          chainlinkData.LINK,
          ['function transfer(address _to, uint256 _value) returns (bool)'],
          devDeployerSigner,
        );
        const txTransfer = await linkContract.transfer(ans.exchange_manager_address, requiredLinkFee, {
          maxFeePerGas,
          maxPriorityFeePerGas,
        });

        const txTransferReceipt = await txTransfer.wait();
        console.log(
          `💰💰💰 LINK fee is transferred from devDeployer to Exchange Manager.\nBlock: ${txTransferReceipt.blockNumber}\nTransaction: ${txTransferReceipt.transactionHash}\nValue: ${chainlinkData.fee}`,
        );
      }
      const omnuumExchange = await ethers.getContractAt('OmnuumExchange', ans.exchange_manager_address);

      const sendEtherFee = (await omnuumExchange.tmpLinkExRate())
        .mul(requiredLinkFee)
        .div(ethers.utils.parseEther('1'))
        .mul(ethers.BigNumber.from(await vrfManager.safetyRatio()))
        .div(ethers.BigNumber.from('100'));

      console.log(
        `💰 Sending ${chalk.redBright(sendEtherFee)} ${
          chainName === 'matic' || chainName === 'mumbai' ? 'MATIC' : 'ETH'
        } to revealManager...\n=> Value is sent through internal transaction to VRF manager\n${chalk.green(
          '=> Request Verifiable Random Function to ChainLINK Oracle',
        )}`,
        sendEtherFee,
      );

      const response = await queryGasDataAndProceed(provider);
      maxFeePerGas = response.maxFeePerGas;
      maxPriorityFeePerGas = response.maxPriorityFeePerGas;
      proceed = response.proceed;
      if (!proceed) {
        console.log('Transaction Aborted!');
        return;
      }

      const txResponse = await revealManager
        .connect(nftOwnerSigner)
        .vrfRequest(ans.nft_address, { value: sendEtherFee, maxFeePerGas, maxPriorityFeePerGas });

      console.log('txRseponse', txResponse);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(
        `${chalk.yellowBright('💋 VRF request is on the way.')}\nBlock: ${txReceipt.blockNumber}\nTransaction: ${
          txReceipt.transactionHash
        }`,
      );
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
