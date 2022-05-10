const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const chalk = require('chalk');
const { mkdir, writeFile } = require('fs/promises');
const AWS = require('aws-sdk');
const { getRPCProvider, nullCheck, getDateSuffix, getChainName } = require('../deployments/deployHelper');
const { getWalletFromMnemonic } = require('../walletFromMnemonic');

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
    message: chalk.yellowBright('🤔 Beacon address (for NFT1155) to be upgraded is...'),
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

      const ContractFactory = (await ethers.getContractFactory('OmnuumNFT1155')).connect(deployerSigner);
      const BeaconContract = new ethers.Contract(
        ans.beacon_address,
        new ethers.utils.Interface(['function implementation() external view returns(address)']),
        provider,
      );

      const previousImplAddress = await BeaconContract.implementation();

      // Go Beacon Upgrade!
      console.log(chalk.greenBright('!!! Starting Beacon Upgrade --- NFT1155'));
      const upgraded = await upgrades.upgradeBeacon(ans.beacon_address, ContractFactory);
      const txReceipt = await upgraded.deployTransaction.wait();

      const iFace = new ethers.utils.Interface(['event Upgraded(address indexed implementation)']);
      const { implementation } = iFace.parseLog(txReceipt.events[0]).args;

      const resultData = {
        upgradeTarget: 'OmnuumNFT1155',
        chain: chainName,
        timeStamp: new Date().toLocaleString(),
        deployer: deployerSigner.address,
        beaconAddress: txReceipt.to,
        previousImplAddress,
        upgradedImplAddress: implementation,
        transaction: txReceipt.transactionHash,
      };
      console.log(chalk.yellowBright('☀️ Result\n'), resultData);
      console.log(chalk.greenBright('New NFT1155 Implementation deployed, then Beacon upgrade is done!'));

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
          const filename = `${chainName}_${getDateSuffix()}_NFT1155_upgrade.json`;
          if (result.localSave) {
            await writeFile(`${dirPath}/${filename}`, JSON.stringify(resultData), 'utf8');
          }
          if (result.s3Save) {
            AWS.config.region = 'ap-northeast-2';
            const s3 = new AWS.S3();
            const bucketName = 'omnuum-prod-website-resources';
            const keyName = `contracts/${filename}`;
            const s3Promise = s3
              .putObject({
                Bucket: bucketName,
                Key: keyName,
                Body: Buffer.from(JSON.stringify(resultData)),
              })
              .promise();
            s3Promise
              .then((data) => {
                console.log('data', data);
                console.log(`Successfully uploaded data to ${bucketName}/${keyName}`);
              })
              .catch((e) => console.error(e));
          }
        });
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
