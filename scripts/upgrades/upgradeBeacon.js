const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');
const { mkdir, writeFile } = require('fs/promises');
const { getRPCProvider, nullCheck, getDateSuffix, getChainName } = require('../deployments/deployHelper');
const { getWalletFromMnemonic } = require('../../utils/walletFromMnemonic');
const { s3Upload } = require('../../utils/s3.js');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  beacon_address: 'beacon_address',
  signer_method: 'signer_method',
  proceed: 'proceed',
  localSave: 'localSave',
  s3Save: 's3Save',
};

const questions = [
  {
    name: inquirerParams.beacon_address,
    type: 'input',
    message: chalk.yellowBright('🤔 Beacon address (for NFT721) to be upgraded is...'),
    validate: nullCheck,
  },
  {
    name: inquirerParams.signer_method,
    type: 'list',
    message: chalk.yellowBright('🤔 How to create deployer signer'),
    choices: ['from_PK', 'from_mnemonic'],
    validate: nullCheck,
  },
];

(async () => {
  console.log(
    chalk.yellow(`
                                                     ######
 #    # #####   ####  #####    ##   #####  ######    #     # ######   ##    ####   ####  #    #
 #    # #    # #    # #    #  #  #  #    # #         #     # #       #  #  #    # #    # ##   #
 #    # #    # #      #    # #    # #    # #####     ######  #####  #    # #      #    # # #  #
 #    # #####  #  ### #####  ###### #    # #         #     # #      ###### #      #    # #  # #
 #    # #      #    # #   #  #    # #    # #         #     # #      #    # #    # #    # #   ##
  ####  #       ####  #    # #    # #####  ######    ######  ###### #    #  ####   ####  #    #
  
  `),
  );

  inquirer.prompt(questions).then(async (ans) => {
    try {
      const dirPath = './scripts/deployments/deployResults/upgrades';
      await mkdir(dirPath, { recursive: true });
      const chainName = await getChainName();

      const provider = await getRPCProvider(ethers.provider);

      let deployerSigner;
      if (ans.signer_method === 'from_PK') {
        const { deployer_private_key } = await inquirer.prompt([
          {
            name: inquirerParams.deployer_private_key,
            type: 'input',
            message: chalk.yellowBright('🤔 Deployer Private Key is...'),
            validate: nullCheck,
          },
        ]);
        deployerSigner = new ethers.Wallet(deployer_private_key, provider);
      } else if (ans.signer_method === 'from_mnemonic') {
        deployerSigner = await getWalletFromMnemonic(provider);
      }

      const deployerAddress = deployerSigner.address;
      const deployerBalance = ethers.utils.formatEther(await deployerSigner.getBalance());

      const { proceed } = await inquirer.prompt([
        {
          name: inquirerParams.proceed,
          type: 'confirm',
          message: chalk.yellow(
            `${chalk.redBright(
              'ATTENTION!!!!!!',
            )}\n\tDeployer: ${deployerAddress}\n\tBalance: ${deployerBalance} ETH\n\tNetwork: ${chainName}\n ${chalk.red(
              '=> Do you want to proceed?',
            )}`,
          ),
        },
      ]);

      // eslint-disable-next-line consistent-return
      if (!proceed) return;

      const ContractFactory = (await ethers.getContractFactory('OmnuumNFT721')).connect(deployerSigner);
      const BeaconContract = new ethers.Contract(
        ans.beacon_address,
        new ethers.utils.Interface(['function implementation() external view returns(address)']),
        provider,
      );

      const previousImplAddress = await BeaconContract.implementation();

      // Go Beacon Upgrade!
      console.log(chalk.greenBright('!!! Starting Beacon Upgrade --- NFT721'));
      const upgraded = await upgrades.upgradeBeacon(ans.beacon_address, ContractFactory);
      const txReceipt = await upgraded.deployTransaction.wait();

      const iFace = new ethers.utils.Interface(['event Upgraded(address indexed implementation)']);
      const { implementation } = iFace.parseLog(txReceipt.events[0]).args;

      const resultData = {
        upgradeTarget: 'OmnuumNFT721',
        chain: chainName,
        timeStamp: new Date().toLocaleString(),
        deployer: deployerSigner.address,
        beaconAddress: txReceipt.to,
        previousImplAddress,
        upgradedImplAddress: implementation,
        transaction: txReceipt.transactionHash,
      };
      console.log(chalk.yellowBright('\n☀️ Result\n'), resultData);
      console.log(chalk.greenBright('\nNew NFT721 Implementation deployed, then Beacon upgrade is done!'));

      inquirer
        .prompt([
          {
            name: inquirerParams.localSave,
            type: 'confirm',
            message: chalk.yellow(`Save result JSON file to ${chalk.redBright('local')}`),
          },
          {
            name: inquirerParams.s3Save,
            type: 'confirm',
            message: chalk.yellow(`Save result JSON file to ${chalk.redBright('S3')}`),
          },
        ])
        .then(async (result) => {
          const filename = `${chainName}_${getDateSuffix()}_NFT721_upgrade.json`;
          if (result.localSave) {
            await writeFile(`${dirPath}/${filename}`, JSON.stringify(resultData), 'utf8');
          }
          if (result.s3Save) {
            await s3Upload({
              bucketName: 'omnuum-prod-website-resources',
              keyName: `contracts/upgrades/${filename}`,
              fileBuffer: Buffer.from(JSON.stringify(resultData)),
            });
          }
        });
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
