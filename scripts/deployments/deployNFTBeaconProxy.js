const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const chalk = require('chalk');
const DEP_CONSTANTS = require('./deployConstants');
const { deployNFT } = require('./deployments');
const { getDateSuffix, nullCheck, getRPCProvider, getChainName } = require('./deployHelper');

const inquirerParams = {
  dev_deployer_private_key: 'dev_deployer_private_key',
  project_owner_private_key: 'project_owner_private_key',
  nft_beacon_address: 'nft_beacon_address',
  ca_manager_proxy_address: 'ca_manager_proxy_address',
  wallet_address: 'wallet_address',
  max_supply: 'max_supply',
  cover_uri: 'cover_uri',
  payment_value: 'payment_value',
  nft_collection_id: 'nft_collection_id',
};

const questions = [
  {
    name: inquirerParams.project_owner_private_key,
    type: 'input',
    message: '🤔 Project owner private key who become owner is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.payment_value,
    type: 'input',
    message: '🤔 Cost of deployment is (in ether)...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_collection_id,
    type: 'input',
    message: '🤔 NFT collection id you would like is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_beacon_address,
    type: 'input',
    message: '🤔 Your NFT1155 beacon address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ca_manager_proxy_address,
    type: 'input',
    message: '🤔 Your CA manager proxy address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.wallet_address,
    type: 'input',
    message: '🤔 Your Wallet contract address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.max_supply,
    type: 'input',
    message: '🤔 Max supply is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.cover_uri,
    type: 'input',
    message: '🤔 Cover uri is...',
    validate: nullCheck,
  },
];

(async () => {
  upgrades.silenceWarnings();

  console.log(`
   ****     **    ********   **********
  /**/**   /**   /**/////   /////**///
  /**//**  /**   /**            /**
  /** //** /**   /*******       /**
  /**  //**/**   /**////        /**
  /**   //****   /**            /**
  /**    //***   /**            /**
  //      ///    //             //
  `);

  inquirer.prompt(questions).then(async (ans) => {
    try {
      const chainName = await getChainName();
      console.log(chalk.green(`${`\nSTART DEPLOYMENT to ${chainName} at ${new Date()}`}`));

      const provider = await getRPCProvider(ethers.provider);
      const OmnuumDeploySigner =
        chainName === 'localhost'
          ? (await ethers.getSigners())[0]
          : await new ethers.Wallet(process.env.OMNUUM_DEPLOYER_PRIVATE_KEY, provider);
      const devDeployerAddr = await OmnuumDeploySigner.getAddress();
      const projectOwnerSigner = new ethers.Wallet(ans.project_owner_private_key, provider);
      const projectOwnerAddress = projectOwnerSigner.address;

      const caManager = (await ethers.getContractFactory('OmnuumCAManager')).attach(ans.ca_manager_proxy_address);
      const wallet = (await ethers.getContractFactory('OmnuumWallet')).attach(ans.wallet_address);
      const nftContractFactory = (await ethers.getContractFactory('OmnuumNFT1155')).connect(OmnuumDeploySigner);

      const deployPayment = {
        topic: DEP_CONSTANTS.nft.topic,
        description: ans.nft_collection_id, // collection_id for deployment
        value: { value: ethers.utils.parseEther(ans.payment_value) },
      };

      await (
        await wallet.connect(projectOwnerSigner).makePayment(deployPayment.topic, deployPayment.description, deployPayment.value)
      ).wait();

      console.log(
        chalk.yellow(
          `\n🌹 NFT deploy fee is paid.
          - Collection Id: ${ans.nft_collection_id}
          - Payment Value: ${ans.payment_value} Ether\n`,
        ),
      );

      const nftDeployment = await deployNFT({
        nftBeaconAddress: ans.nft_beacon_address,
        nftContractFactory,
        caManageProxyAddr: ans.ca_manager_proxy_address,
        devDeployerAddr,
        maxSupply: ans.max_supply,
        coverUri: ans.cover_uri,
        projectOwnerAddress,
      });

      const { transactionHash, blockNumber, gasUsed } = nftDeployment.deployReceipt;

      console.log(
        chalk.yellow(
          `🌹 NFT Project Proxy is deployed.
          - Beacon Proxy Address: ${nftDeployment.beaconProxy.address}
          - Owner:${projectOwnerAddress}
          - Block:${blockNumber}
          - Transaction:${transactionHash}
          - Gas:${gasUsed.toNumber()}
          `,
        ),
      );

      const filename = `${chainName}_${getDateSuffix()}.json`;
      fs.writeFileSync(
        `./scripts/deployments/deployResults/nft/${filename}`,
        Buffer.from(
          JSON.stringify({
            nftProject: {
              beaconProxy: nftDeployment.beaconProxy.address,
              projectOwner: projectOwnerAddress,
              blockNumber,
              transactionHash,
              gasUsed: gasUsed.toNumber(),
            },
          }),
        ),
        'utf8',
      );

      /* register NFT beacon proxy contract to CA manager */
      const txRegister = await caManager.connect(OmnuumDeploySigner).registerNftContract(nftDeployment.beaconProxy.address);
      const deployResponse = await txRegister.wait();

      console.log(
        chalk.yellow(
          `🌹 NFT Project is registered to CA Manager.
          - Block: ${deployResponse.blockNumber}
          - Transaction: ${deployResponse.transactionHash}`,
        ),
      );
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
