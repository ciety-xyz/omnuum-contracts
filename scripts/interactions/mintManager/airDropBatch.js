const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const { go, chunk, map } = require('fxjs');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');

const inquirerParams = {
  airdropReceiversFileName: 'airdropReceiversFileName',
  nftContractAddress: 'nftContractAddress',
  airdropChunk: 'airdropChunk',
  mintManagerAddress: 'mintManagerAddress',
  nftProjectOwnerPrivateKey: 'nftProjectOwnerPrivateKey',
  airdropQty: 'airdropQty',
};

const airdropReceiverResourceFolderPath = path.resolve(__dirname, './airdropResources');
const getAirdropList = fs.readdirSync(airdropReceiverResourceFolderPath);

const questions = [
  {
    name: inquirerParams.nftProjectOwnerPrivateKey,
    type: 'input',
    message: '🤔 NFT project owner [PRIVATE KEY] is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airdropReceiversFileName,
    type: 'list',
    message: '🤔 Choose [JSON file] having eligible airdrop receivers ...',
    choices: getAirdropList,
  },
  {
    name: inquirerParams.mintManagerAddress,
    type: 'input',
    message: '🤔 [MINT MANAGER] address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nftContractAddress,
    type: 'input',
    message: '🤔 [NFT CONTRACT] address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airdropChunk,
    type: 'input',
    message: '🤔 How many chunks for airdropping ? ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.airdropQty,
    type: 'input',
    message: '🤔 How many airdrop item per reciever ? ...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nftProjectOwnerPrivateKey, provider);
      const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mintManagerAddress).connect(nftOwnerSigner);
      let airdropCum = 0;
      let airdropRound = 0;
      let cumulativeGasUsed = ethers.BigNumber.from(0);
      let cumulativeReceivers = 0;
      const airdropReceivers = JSON.parse(
        fs.readFileSync(path.resolve(airdropReceiverResourceFolderPath, `${ans.airdropReceiversFileName}`)),
      );
      await go(
        airdropReceivers,
        chunk(ans.airdropChunk),
        map(async (airdropReceiverGroup) => {
          const value = ethers.utils.parseEther('0.0005').mul(Number(ans.airdropQty) * Number(airdropReceiverGroup.length));
          const args = [ans.nftContractAddress, airdropReceiverGroup, [...airdropReceiverGroup].fill(Number(ans.airdropQty)), { value }];
          const trxResponse = await mintManager.mintMultiple(...args);
          const txReceipt = await trxResponse.wait();
          console.log('\n==================================================');
          console.log(`
            Airdrop Round: ${(airdropRound += 1)}
            Block: ${txReceipt.blockNumber}
            Transaction: ${txReceipt.transactionHash}
            Gas Used: ${txReceipt.gasUsed.toString()}
            Receivers Index: ${airdropCum} ~ ${(airdropCum += airdropReceiverGroup.length - 1)}
            Receivers: 총 ${airdropReceiverGroup.length} 명 빋음.
            `);
          cumulativeGasUsed = cumulativeGasUsed.add(txReceipt.gasUsed);
          cumulativeReceivers += airdropReceiverGroup.length;
          return txReceipt;
        }),
      );
      console.log(`
          Total airdrop round: ${airdropRound}
          Total gas used : ${cumulativeGasUsed.toString()}
          Total airdrop receivers: ${cumulativeReceivers}
        `);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
