const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { getAdminAddress } = require('@openzeppelin/upgrades-core');
const { mkdir, writeFile } = require('fs/promises');
const { nullCheck, getRPCProvider, getChainName, getDateSuffix } = require('../deployments/deployHelper');
const { getWalletFromMnemonic } = require('../../utils/walletFromMnemonic');
const { s3Upload } = require('../../utils/s3.js');

const inquirerParams = {
  deployer_private_key: 'deployer_private_key',
  proxy_address: 'proxy_address',
  contract_name: 'contract_name',
  signer_method: 'signer_method',
  proceed: 'proceed',
  localSave: 'localSave',
  s3Save: 's3Save',
};

const getSolidityFileList = fs
  .readdirSync(path.resolve(__dirname, '../../contracts/V1'))
  .map((filename) => filename.substr(0, filename.indexOf('.')));

const questions = [
  {
    name: inquirerParams.contract_name,
    type: 'list',
    message: chalk.yellowBright('🤔 Choose contract you want to upgrade is ...'),
    choices: getSolidityFileList,
  },
  {
    name: inquirerParams.proxy_address,
    type: 'input',
    message: chalk.yellowBright('🤔 Proxy Address to be upgraded is...'),
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
 #    # #####   ####  #####    ##   #####  ######    #     # #####   ####  #    # #   #
 #    # #    # #    # #    #  #  #  #    # #         #     # #    # #    #  #  #   # #
 #    # #    # #      #    # #    # #    # #####     ######  #    # #    #   ##     #
 #    # #####  #  ### #####  ###### #    # #         #       #####  #    #   ##     #
 #    # #      #    # #   #  #    # #    # #         #       #   #  #    #  #  #    #
  ####  #       ####  #    # #    # #####  ######    #       #    #  ####  #    #   #
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
            `ATTENTION!!!!!!\n\tDeployer: ${deployerAddress}\n\tBalance: ${deployerBalance} ETH\n\tNetwork: ${chainName}\n ${chalk.red(
              '=> Do you want to proceed?',
            )}`,
          ),
        },
      ]);

      // eslint-disable-next-line consistent-return
      if (!proceed) return;

      const ContractFactory = (await ethers.getContractFactory(ans.contract_name)).connect(deployerSigner);

      const adminAddress = await getAdminAddress(provider, ans.proxy_address);
      const AdminContract = new ethers.Contract(
        adminAddress,
        new ethers.utils.Interface(['function getProxyImplementation(address proxy) public view returns (address)']),
        provider,
      );

      const previousImplAddress = await AdminContract.getProxyImplementation(ans.proxy_address);

      // Go Proxy Upgrade!
      console.log(chalk.greenBright(`!!! Starting Proxy Upgrade --- ${ans.contract_name}`));
      const upgraded = await upgrades.upgradeProxy(ans.proxy_address, ContractFactory);
      const txReceipt = await upgraded.deployTransaction.wait();

      const iFace = new ethers.utils.Interface(['event Upgraded(address indexed implementation)']);
      const { implementation } = iFace.parseLog(txReceipt.events[0]).args;

      const resultData = {
        upgradeTarget: `${ans.contract_name}`,
        chain: chainName,
        timeStamp: new Date().toLocaleString(),
        deployer: deployerSigner.address,
        proxyAddress: ans.proxy_address,
        adminAddress,
        previousImplAddress,
        upgradedImplAddress: implementation,
      };

      console.log(chalk.yellowBright('\n☀️ Result\n'), resultData);
      console.log(chalk.yellow(`\n${ans.contract_name} Proxy upgrade is done!`));

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
          const filename = `${chainName}_${getDateSuffix()}_${ans.contract_name}_upgrade.json`;
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
