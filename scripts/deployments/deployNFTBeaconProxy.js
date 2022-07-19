const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const fs = require('fs');
const chalk = require('chalk');
const { mkdir } = require('fs/promises');
const { deployNFT } = require('./deployments');
const {
  getDateSuffix,
  nullCheck,
  getChainName,
  getSingleFallbackProvider,
  consoleBalance,
  queryEIP1559GasFeesAndProceed,
  set1559FeeDataToProvider,
  getChainId,
  notNullAndNumber,
} = require('./deployHelper');

const inquirerParams = {
  projectOwnerPrivateKey: 'projectOwnerPrivateKey',
  signerPrivateKey: 'signerPrivateKey',
  senderVerifierAddress: 'senderVerifierAddress',
  nftFactoryAddress: 'nftFactoryAddress',
  maxSupply: 'maxSupply',
  coverUri: 'coverUri',
  collectionId: 'collectionId',
  name: 'name',
  symbol: 'symbol',
};

const questions = [
  {
    name: inquirerParams.projectOwnerPrivateKey,
    type: 'input',
    message: '🤔 Project owner [ PRIVATE KEY ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.signerPrivateKey,
    type: 'input',
    message: '🤔 Signer [ PRIVATE KEY ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.senderVerifierAddress,
    type: 'input',
    message: '🤔 Sender verifier [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nftFactoryAddress,
    type: 'input',
    message: '🤔 Nft factory [ ADDRESS ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.maxSupply,
    type: 'input',
    message: '🤔 [ MAX SUPPLY ] is...',
    validate: notNullAndNumber,
  },
  {
    name: inquirerParams.coverUri,
    type: 'input',
    message: '🤔 [ COVER URI ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.collectionId,
    type: 'input',
    message: '🤔 [ COLLECTION ID ] to be is...',
    validate: notNullAndNumber,
  },
  {
    name: inquirerParams.name,
    type: 'input',
    message: '🤔 [ NAME ] is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.symbol,
    type: 'input',
    message: '🤔 [ SYMBOL ] is...',
    validate: nullCheck,
  },
];

(async () => {
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
      const provider = await getSingleFallbackProvider();

      const chainName = await getChainName();
      console.log(chalk.green(`${`\nSTART DEPLOYMENT to ${chainName} at ${new Date()}`}`));

      const projectOwnerSigner = new ethers.Wallet(ans.projectOwnerPrivateKey, provider);

      await consoleBalance(projectOwnerSigner.address);
      const { maxFeePerGas, maxPriorityFeePerGas, proceed } = await queryEIP1559GasFeesAndProceed();
      if (!proceed) {
        throw new Error('🚨 Transaction Aborted!');
      }

      set1559FeeDataToProvider(projectOwnerSigner.provider, maxFeePerGas, maxPriorityFeePerGas);

      const nftDeployment = await deployNFT({
        projectOwnerSigner,
        senderVerifierAddress: ans.senderVerifierAddress,
        signerPrivateKey: ans.signerPrivateKey,
        maxSupply: ans.maxSupply,
        coverUri: ans.coverUri,
        nftFactoryAddress: ans.nftFactoryAddress,
        collectionId: ans.collectionId,
        name: ans.name,
        symbol: ans.symbol,
        chainId: await getChainId(),
      });

      const { transactionHash, blockNumber, gasUsed } = nftDeployment.deployReceipt;

      console.log(
        chalk.yellow(
          `🌹 NFT Project Proxy is deployed.
          - Beacon Proxy Address: ${nftDeployment.beaconProxyAddress}
          - Owner:${projectOwnerSigner.address}
          - Block:${blockNumber}
          - Transaction:${transactionHash}
          - Gas:${gasUsed.toNumber()}
          `,
        ),
      );

      const filename = `${chainName}_${getDateSuffix()}.json`;

      await mkdir('./scripts/deployments/deployResults/nft', { recursive: true });
      fs.writeFileSync(
        `./scripts/deployments/deployResults/nft/${filename}`,
        Buffer.from(
          JSON.stringify({
            nftProject: {
              beaconProxy: nftDeployment.beaconProxyAddress,
              projectOwner: projectOwnerSigner.address,
              blockNumber,
              transactionHash,
              gasUsed: gasUsed.toNumber(),
            },
          }),
        ),
        'utf8',
      );
    } catch (e) {
      console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    }
  });
})();
