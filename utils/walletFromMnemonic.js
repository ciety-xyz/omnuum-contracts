const inquirer = require('inquirer');
const { go, range, map } = require('fxjs');
const ethers = require('hardhat');
const { nullCheck } = require('../scripts/deployments/deployHelper');

const question = [
  {
    name: 'wordLength',
    type: 'list',
    message: '🤔 Choose 12 or 24 word list ?...',
    choices: ['12', '24'],
    validate: nullCheck,
  },
];

const validateWord = (word) => {
  const isWordInList = ethers.wordlists.en.getWordIndex(word) >= 0;
  if (isWordInList) {
    return true;
  }
  return '🚨 Word is not in the list (BIP39)';
};

const createWordQuestions = async (len) =>
  go(
    range(len),
    map((idx) => {
      const word_index = idx + 1;
      return { name: `word_${word_index}`, type: 'password', mask: '*', message: `Input word [${word_index}]`, validate: validateWord };
    }),
  );

const createWalletPath = (i) => `m/44'/60'/0'/0/${i}`;

const getWalletFromMnemonic = async (provider) => {
  const { wordLength } = await inquirer.prompt(question);
  const wordQuestions = await createWordQuestions(Number(wordLength));
  const wordList = await inquirer.prompt(wordQuestions);
  const mnemonic = Object.values(wordList).join(' ');
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, createWalletPath(0), ethers.wordlists.en);
  if (provider) {
    return wallet.connect(provider);
  }
  return wallet;
};

module.exports = { getWalletFromMnemonic, validateWord };
