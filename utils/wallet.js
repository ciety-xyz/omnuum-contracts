const Mnemonic = require('bitcore-mnemonic');
const chalk = require('chalk');
const ethers = require('ethers');
const { map, range, go } = require('fxjs');
const assert = require('assert');

// console.log(ethers.wordlists.en.getWord(2047));

const createWalletPath = (i) => `m/44'/60'/0'/0/${i}`;

function createWallet() {
  // assert.deepStrictEqual(
  //   Mnemonic.Words.ENGLISH,
  //   go(
  //     range(2048),
  //     map((idx) => ethers.wordlists.en.getWord(idx)),
  //   ),
  // );

  const mnemonic = new Mnemonic(256);
  const xpriv = mnemonic.toHDPrivateKey();

  console.log(
    `
\t${chalk.red('mnenomic')}:

\tA: ${mnemonic.toString().split(' ').slice(0, 8)}

\tB: ${mnemonic.toString().split(' ').slice(8, 16)}

\tC: ${mnemonic.toString().split(' ').slice(16, 24)}

\t${chalk.green('xpriv')}: ${xpriv}
`,
  );

  const wallet = ethers.Wallet.fromMnemonic(mnemonic.toString());
  console.log(`${chalk.green('private key')}: ${wallet.privateKey}`);
  console.log(`${chalk.green('public key')}: ${wallet.publicKey}`);
  console.log(`${chalk.green('wallet address')}: ${wallet.address}`);
  console.log(`${chalk.green('recovery phrase')}: ${mnemonic.toString()}`);
  console.log(wallet.address.substring(0, 4).toLowerCase());
  if (wallet.address.substring(0, 4).toLowerCase() !== '0xc1') {
    createWallet();
  }
}

function getPkFromMnemonic(mnemonic) {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, createWalletPath(0), ethers.wordlists.en);

  console.log('pk', wallet.privateKey);

  console.log(
    `
\t${chalk.white('Wallet(0):')} ${wallet.address}`,
  );
}

createWallet();
// getPkFromMnemonic();
