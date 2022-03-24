const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { addHours } = require('date-fns');
const { nullCheck, getRPCProvider } = require('../../deployments/deployHelper');
const { toSolDate } = require('../../../test/etc/util.js');

const inquirerParams = {
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  group_id: 'group_id',
  end_day_from_now: 'end_day_from_now',
  ticket_manager_address: 'ticket_manager_address',
};

const questions = [
  {
    name: inquirerParams.nft_owner_private_key,
    type: 'input',
    message: '🤔 NFT project owners private key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_address,
    type: 'input',
    message: '🤔 NFT project contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ticket_manager_address,
    type: 'input',
    message: '🤔 Ticket manager address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.group_id,
    type: 'input',
    message: '🤔 Ticket schedule group id is... (uint: dec)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.end_day_from_now,
    type: 'input',
    message: '🤔 How much end day from now is... (unit: hr)',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    try {
      const provider = await getRPCProvider(ethers.provider);
      const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);

      const ticketManager = (await ethers.getContractFactory('TicketManager')).attach(ans.ticket_manager_address);

      const txResponse = await ticketManager
        .connect(nftOwnerSigner)
        .setEndDate(ans.nft_address, ans.group_id, toSolDate(addHours(new Date(), Number(ans.end_day_from_now))));

      const txReceipt = await txResponse.wait();

      console.log(txReceipt);
      console.log(`💋 Ticket schedule is set..\nBlock: ${txReceipt.blockNumber}\nTransaction: ${txReceipt.transactionHash}`);
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
