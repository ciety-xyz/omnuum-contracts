const inquirer = require('inquirer');
const { ethers } = require('hardhat');

const { nullCheck, getRPCProvider, getChainName } = require('../../deployments/deployHelper');
const { testValues, chainlink } = require('../../../utils/constants');

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
      const provider = await getRPCProvider(ethers.provider);
      const devDeployerSigner = new ethers.Wallet(ans.dev_deployer_private_key, provider);

      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);
      const revealManager = (await ethers.getContractFactory('RevealManager')).attach(ans.reveal_manager_address);
      const vrfManager = (await ethers.getContractFactory('OmnuumVRFManager')).attach(ans.vrf_manager_address);

      const linkContract = new ethers.Contract(
        chainlink[chainName].LINK,
        ['function transfer(address _to, uint256 _value) returns (bool)'],
        devDeployerSigner
      );
      const txTransfer = await linkContract.transfer(ans.exchange_manager_address, chainlink[chainName].fee);

      const txTransferReceipt = await txTransfer.wait();
      console.log(txTransferReceipt);
      console.log(
        `💰💰💰 Fee Transfer from devDeployer to Exchange Manager.\nBlock: ${txTransferReceipt.blockNumber}\nTransaction: ${txTransferReceipt.transactionHash}\nValue: ${chainlink[chainName].fee}`
      );

      const amountLinkFee = chainlink[chainName].fee; // 0.1 ether for Rinkeby
      const safetyRatio = await vrfManager.safetyRatio();

      const value = testValues.tmpExchangeRate
        .mul(amountLinkFee)
        .div(ethers.utils.parseEther('1'))
        .mul(ethers.BigNumber.from(safetyRatio))
        .div(ethers.BigNumber.from('100'));

      console.log('💰 Send value', value);

      const txResponse = await revealManager.connect(nftOwnerSigner).vrfRequest(ans.nft_address, { value, gasLimit: 10000000 });

      console.log('txRseponse', txResponse);
      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 VRF request is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
