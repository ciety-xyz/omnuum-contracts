const chalk = require('chalk');
const { ethers, upgrades } = require('hardhat');
const { add, range, go, map } = require('fxjs');
const { addDays } = require('date-fns');

upgrades.silenceWarnings();

const gas_price = 20; // in gwei

const roundTo = (n, to) => Math.round(n * 10 ** to) / 10 ** to;
const calcGasPrice = (gas) => roundTo((gas * gas_price) / 10 ** 9, 3);

const { prepareDeploy, testDeploy, prepareMockDeploy, deployNFT } = require('../test/etc/mock.js');
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
    omnuumNFT721,
    ticketManager,
    signatureSigner,
  } = this;

  const group_id = 1;
  const end_date = toSolDate(addDays(new Date(), 2));

  const price = ethers.utils.parseEther('0.2');

  // give Ticket to minter
  const ticket = await createTicket(
    { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity },
    signatureSigner,
    ticketManager.address,
  );
  await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

  const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

  const tx = await omnuumNFT721.connect(minterAC).ticketMint(quantity, ticket, payload, {
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
    omnuumNFT721,
    omnuumMintManager,
    signatureSigner,
  } = this;

  const basePrice = ethers.utils.parseEther('0.1');
  const group_id = 100;
  const end_date = toSolDate(addDays(new Date(), 2));

  const open_quantity = 2000;
  const max_min_per_address = 2000;

  // make NFT public
  await (
    await omnuumMintManager.setPublicMintSchedule(omnuumNFT721.address, group_id, end_date, basePrice, open_quantity, max_min_per_address)
  ).wait();

  const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

  const tx = await omnuumNFT721.connect(minterAC).publicMint(quantity, group_id, payload, {
    value: basePrice.mul(quantity),
  });

  const gas = await getGas(tx);

  console.log(`Public Minting Gas (${chalk.yellow(quantity)}): ${chalk.green(gas)}, ${chalk.green(calcGasPrice(gas))} ether`);
}

async function estimateMintGas() {
  const quantity_cases = [1, 2, 3, 5, 10, 20, 50, 100, 1000];

  console.log('Ticket Case ----------');
  await map((quantity) => createTicketMintCase(quantity), quantity_cases);

  console.log('\nPublic Case ----------');
  await map((quantity) => createPublicMintCase(quantity), quantity_cases);
  console.log('\n\n');
}

async function estimateNFTProxyDeploymentGas() {
  await prepare();

  const { NFTbeacon, OmnuumNFT1155, omnuumCAManager } = this;

  const { deployTransaction } = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
    caManagerAddress: omnuumCAManager.address,
  });

  const gas = await getGas(deployTransaction);

  console.log(`NFT Proxy Deployment Minting Gas: ${chalk.green(gas)}, ${chalk.green(calcGasPrice(gas))} ether`);
}

async function estimateNFTAirdropGas() {
  try {
    await prepare();
    const {
      accounts: [omnuumAC, minterAC],
      senderVerifier,
      omnuumNFT1155,
      ticketManager,
      omnuumMintManager,
    } = this;

    const estimateCase = async (count, quantitys) => {
      const airdrop_input_quantity = go(
        range(count),
        map((i) => quantitys[i % quantitys.length]),
      );

      const total_quantity = airdrop_input_quantity.reduce(add);

      const airdrop_input_address = go(
        range(count),
        map(() => minterAC.address),
      );

      try {
        const tx = await omnuumMintManager.mintMultiple(omnuumNFT1155.address, airdrop_input_address, airdrop_input_quantity, {
          value: ethers.utils.parseEther('1'),
        });

        const gas = await getGas(tx);

        console.log(
          `Airdrop (Address: ${chalk.yellow(count)}, quantitys: ${chalk.yellow(`[${quantitys.join(', ')}]`)}): ${chalk.green(
            gas,
          )}, ${chalk.green(calcGasPrice(gas))} ether`,
        );
      } catch (err) {
        console.error(err);
        console.log(`[error] count: ${chalk.yellow(count)}, quantitys: ${chalk.yellow(`[${quantitys.join(',')}]`)}
        ${err.message}`);
      }
    };

    console.log('\n[Theoretical Case]');
    // await estimateCase(1, [1]);
    // await estimateCase(1, [2]);
    // await estimateCase(1, [3]);
    // await estimateCase(1, [5]);
    // await estimateCase(1, [10]);
    // await estimateCase(10, [1]);
    // await estimateCase(10, [2]);
    // await estimateCase(100, [1]);
    // await estimateCase(100, [2]);
    await estimateCase(200, [1]);
    // await estimateCase(300, [1]);
    // await estimateCase(400, [1]);
    // await estimateCase(500, [1]);
    // await estimateCase(1000, [1]);
    // await estimateCase(1000, [2]);

    // possible case
    console.log('\n[Possible Case]');
    // await estimateCase(1000, [1, 2, 3, 4, 5]);
    // await estimateCase(2000, [1, 2, 3, 4, 5]);
    // await estimateCase(3000, [1, 2, 3, 4, 5]);
    // await estimateCase(5000, [1, 2, 3, 4, 5]);

    // 1명 x 여러개
  } catch (err) {
    console.error(err);
  }
}

async function estimatePureMintGas() {
  const GasNFT = await ethers.getContractFactory('GasNFT');
  const MockMintManager = await ethers.getContractFactory('MockMintManager');
  const gasNFT = await GasNFT.deploy();
  const mockMintManager = await MockMintManager.deploy();
  await gasNFT.deployed();
  await mockMintManager.deployed();

  const count = 200;
  const quantity = 1;

  const signer = await ethers.getSigner();

  const getArgs = () => [
    go(
      range(count),
      map(() => signer.address),
    ),
    go(
      range(count),
      map(() => quantity),
    ),
  ];

  // pure
  const gas = await getGas(await gasNFT.mintMultiple(getArgs()[0]));
  console.log(`Pure Mint Gas (${chalk.yellow(quantity)}): ${chalk.yellow(gas)}`);

  // multi mint
  // const gas2 = await getGas(await gasNFT.mintMultiple2(...getArgs()));
  // console.log(
  //   `Multi quantity (${chalk.yellow(count)} x ${chalk.yellow(quantity)}): ${chalk.yellow(gas)} (${Math.floor(gas / (count * quantity))})`,
  // );

  // const tx = await mockMintManager.airdrop(gasNFT.address, ...getArgs());
  //
  // const gas = await getGas(tx);
  //
  // console.log(
  //   `External Call Mint Gas (${chalk.yellow(count)} x ${chalk.yellow(quantity)}): ${chalk.yellow(gas)} (${Math.floor(
  //     gas / (count * quantity),
  //   )})`,
  // );
}

estimateMintGas();
// estimateNFTProxyDeploymentGas();
// estimateNFTAirdropGas();
// estimatePureMintGas();
