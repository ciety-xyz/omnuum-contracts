const chalk = require('chalk');
const { ethers, upgrades } = require('hardhat');
const { map } = require('fxjs');
const { addDays } = require('date-fns');

upgrades.silenceWarnings();

const gas_price = 100; // in gwei

const roundTo = (n, to) => Math.round(n * 10 ** to) / 10 ** to;
const calcGasPrice = (gas) => roundTo((gas * gas_price) / 10 ** 9, 3);

const { prepareDeploy, testDeploy } = require('../test/etc/mock.js');
const { createTicket, signPayload, toSolDate, createEmptyTicketForPublicMint } = require('../test/etc/util.js');
const Constants = require('../utils/constants.js');

async function prepare() {
  await prepareDeploy.call(this);
  this.accounts = await ethers.getSigners();
  await testDeploy.apply(this, [this.accounts, { maxMintPerAddress: 200 }]);
}

async function getGas(tx) {
  const { gasUsed } = await tx.wait();
  return gasUsed;
}

async function createTicketMintCase(quantity) {
  await prepare();

  const {
    accounts: [omnuumAC, minterAC, receiverAC],
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

  const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, quantity, ticket, payload, {
    value: price.mul(quantity),
  });

  const gas = await getGas(tx);

  console.log(`Ticket Minting Gas (${chalk.yellow(quantity)}): ${chalk.green(gas)}, ${chalk.green(calcGasPrice(gas))} ether`);
}

async function createPublicMintCase(quantity) {
  await prepare();

  const {
    accounts: [omnuumAC, minterAC, receiverAC],
    senderVerifier,
    omnuumNFT1155,
  } = this;

  const basePrice = ethers.utils.parseEther('0.1');
  const end_date = toSolDate(addDays(new Date(), 2));
  const nounce = 1;

  // make NFT public
  await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

  const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

  const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

  const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, quantity, priceWithEmptyTicket, payload, {
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
