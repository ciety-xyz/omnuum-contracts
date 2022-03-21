const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const { addHours } = require('date-fns');
const { nullCheck, getRPCProvider } = require('../../deployHelper');
const { toSolDate } = require('../../../../test/etc/util.js');

const inquirerParams = {
  nft_owner_private_key: 'nft_owner_private_key',
  nft_address: 'nft_address',
  mint_manager_address: 'mint_manager_address',
  group_id: 'group_id',
  end_day_from_now: 'end_day_from_now',
  base_price: 'base_price',
  supply: 'supply',
  max_mint_at_address: 'max_mint_at_address',
};

const questions = [
  {
    name: inquirerParams.nft_owner_private_key,
    type: 'input',
    message: '🤔 nft_owner_private_key is ...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_address,
    type: 'input',
    message: '🤔 nft_address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.mint_manager_address,
    type: 'input',
    message: '🤔 mint_manager_address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.group_id,
    type: 'input',
    message: '🤔 Mint schedule group_id is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.end_day_from_now,
    type: 'input',
    message: '🤔 How much end day from now is... (unit: hr)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.base_price,
    type: 'input',
    message: '🤔 How much is the base_price... (unit: ether)',
    validate: nullCheck,
  },
  {
    name: inquirerParams.supply,
    type: 'input',
    message: '🤔 How much supply...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.max_mint_at_address,
    type: 'input',
    message: '🤔 How much max mint quantity peraddress...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    const provider = await getRPCProvider(ethers.provider);
    const nftOwnerSigner = new ethers.Wallet(ans.nft_owner_private_key, provider);

    const mintManager = (await ethers.getContractFactory('OmnuumMintManager')).attach(ans.mint_manager_address);

    const txResponse = await mintManager
      .connect(nftOwnerSigner)
      .setPublicMintSchedule(
        ans.nft_address,
        ans.group_id,
        toSolDate(addHours(new Date(), Number(ans.end_day_from_now))),
        ethers.utils.parseEther(ans.base_price),
        Number(ans.supply),
        Number(ans.max_mint_at_address)
      );

    const txReceipt = await txResponse.wait();

    console.log('Mint schedule is set.');
    console.log(txReceipt);
  });
})();
