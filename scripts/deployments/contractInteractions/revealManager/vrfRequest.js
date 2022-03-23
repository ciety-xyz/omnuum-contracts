const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { nullCheck, getRPCProvider, getChainName } = require('../../deployHelper');
const { testValues, chainlink } = require('../../../../utils/constants');

const inquirerParams = {
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  reveal_manager_address: 'reveal_manager_address',
  vrf_manager_address: 'vrf_manager_address',
};

const questions = [
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
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);
      const revealManager = (await ethers.getContractFactory('RevealManager')).attach(ans.reveal_manager_address);
      const vrfManager = (await ethers.getContractFactory('OmnuumVRFManager')).attach(ans.vrf_manager_address);

      const amountLinkFee = chainlink[await getChainName()].fee; // 0.1 ether for Rinkeby
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
      console.log(`☀️ VRF request is on the way.\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();

/*
 * cc29e2d107cd37457e557c08a167aa546750372a9127cf3c9268d386808cd872
 * 0x31649c05f4cb7add1027ce16c57f88eee1677830
 * 0x74ff76ddd9e96d1b459e520913e194e70963f743
 * 0xf919e98e12f6e57a0da8a58be0ea4143e42d57cc
 * */
