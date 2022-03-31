const chalk = require('chalk');
const { ethers, upgrades } = require('hardhat');
const { map } = require('fxjs');
const { addDays } = require('date-fns');

upgrades.silenceWarnings();

const gas_price = 50; // in gwei

const roundTo = (n, to) => Math.round(n * 10 ** to) / 10 ** to;
const calcGasPrice = (gas) => roundTo((gas * gas_price) / 10 ** 9, 3);

const { prepareDeploy, testDeploy, prepareMockDeploy } = require('../test/etc/mock.js');
const { createTicket, signPayload, toSolDate } = require('../test/etc/util.js');
const Constants = require('./constants.js');

async function prepare() {
  await prepareDeploy.call(this);
  this.accounts = await ethers.getSigners();
  await prepareMockDeploy.call(this);
  await testDeploy.apply(this, [this.accounts, { maxMintPerAddress: 200 }]);
}

async function getGas(tx) {
  const { gasUsed } = await tx.wait();
  return gasUsed;
}

async function createTicketMintCase(quantity) {
  await prepare();

  const {
    accounts: [omnuumAC, minterAC],
    senderVerifier,
    omnuumNFT1155,
    ticketManager,
  } = this;

  const group_id = 1;
  const end_date = toSolDate(addDays(new Date(), 2));

  const price = ethers.utils.parseEther('0.2');

  // give Ticket to minter
  const ticket = await createTicket(
    { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity },
    omnuumAC,
    ticketManager.address,
  );
  await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

  const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

  const tx = await omnuumNFT1155.connect(minterAC).ticketMint(quantity, ticket, payload, {
    value: price.mul(quantity),
  });

  const gas = await getGas(tx);

  console.log(`Ticket Minting Gas (${chalk.yellow(quantity)}): ${chalk.green(gas)}, ${chalk.green(calcGasPrice(gas))} ether`);
}

async function createPublicMintCase(quantity) {
  await prepare();

  const {
    accounts: [omnuumAC, minterAC],
    senderVerifier,
    omnuumNFT1155,
    omnuumMintManager,
  } = this;

  const basePrice = ethers.utils.parseEther('0.1');
  const group_id = 100;
  const end_date = toSolDate(addDays(new Date(), 2));

  const open_quantity = 2000;
  const max_min_per_address = 300;

  // make NFT public
  await (
    await omnuumMintManager.setPublicMintSchedule(omnuumNFT1155.address, group_id, end_date, basePrice, open_quantity, max_min_per_address)
  ).wait();

  const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

  const tx = await omnuumNFT1155.connect(minterAC).publicMint(quantity, group_id, payload, {
    value: basePrice.mul(quantity),
  });

  const gas = await getGas(tx);

  console.log(`Public Minting Gas (${chalk.yellow(quantity)}): ${chalk.green(gas)}, ${chalk.green(calcGasPrice(gas))} ether`);
}

async function main() {
  const quantity_cases = [1, 2, 3, 5, 10, 20, 50, 100];

  console.log('Ticket Case ----------');
  await map((quantity) => createTicketMintCase(quantity), quantity_cases);

  console.log('\nPublic Case ----------');
  await map((quantity) => createPublicMintCase(quantity), quantity_cases);
  console.log('\n\n');
}

main();
