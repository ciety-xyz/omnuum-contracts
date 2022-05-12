const inquirer = require('inquirer');
const { ethers, upgrades } = require('hardhat');
const fs = require('fs');
const chalk = require('chalk');
const { mkdir } = require('fs/promises');
const { deployNFT } = require('./deployments');
const { getDateSuffix, nullCheck, getRPCProvider, getChainName } = require('./deployHelper');

const inquirerParams = {
  project_owner_private_key: 'project_owner_private_key',
  signer_privateKey: 'signer_privateKey',
  sender_verifier_address: 'sender_verifier_address',
  nft_factory_address: 'nft_factory_address',
  max_supply: 'max_supply',
  cover_uri: 'cover_uri',
  nft_collection_id: 'nft_collection_id',
  name: 'name',
  symbol: 'symbol',
};

const questions = [
  {
    name: inquirerParams.project_owner_private_key,
    type: 'input',
    message: '🤔 Project owner private key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.signer_privateKey,
    type: 'input',
    message: '🤔 Payload signers private key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.sender_verifier_address,
    type: 'input',
    message: '🤔 Sender verifier address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_factory_address,
    type: 'input',
    message: '🤔 Nft factory address is...',
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
  {
    name: inquirerParams.nft_collection_id,
    type: 'input',
    message: '🤔 NFT collection id you would like is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.name,
    type: 'input',
    message: '🤔 NFT name is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.symbol,
    type: 'input',
    message: '🤔 NFT symbol is...',
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
      const chainName = await getChainName();
      console.log(chalk.green(`${`\nSTART DEPLOYMENT to ${chainName} at ${new Date()}`}`));

      const provider = await getRPCProvider(ethers.provider);

      const projectOwnerSigner = new ethers.Wallet(ans.project_owner_private_key, provider);

      const nftDeployment = await deployNFT({
        projectOwnerSigner,
        senderVerifierAddress: ans.sender_verifier_address,
        signerPrivateKey: ans.signer_privateKey,
        maxSupply: ans.max_supply,
        coverUri: ans.cover_uri,
        nftFactoryAddress: ans.nft_factory_address,
        collectionId: ans.nft_collection_id,
        name: ans.name,
        symbol: ans.symbol,
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
