const { ethers, upgrades, config } = require('hardhat');
const { writeFile, mkdir, rm, access } = require('fs/promises');

upgrades.silenceWarnings();

const chalk = require('chalk');
const { deployManagers } = require('./deployments');
const {
  prev_history_file_path,
  tryCatch,
  getDateSuffix,
  structurizeProxyData,
  structurizeContractData,
  getChainName,
  createWalletOwnerAccounts,
  getSingleFallbackProvider,
} = require('./deployHelper');
const DEP_CONSTANTS = require('./deployConstants');
const { compile } = require('../../utils/hardhat.js');
const { s3Upload } = require('../../utils/s3.js');

async function main({
  deployerPK,
  signerAddress,
  maxFeePerGasLimit,
  gasModeAuto = true,
  localSave = true,
  s3Save = false,
  withCompile = true,
}) {
  try {
    console.log(`
         *******    ****     ****  ****     **  **     **  **     **  ****     ****
        **/////**  /**/**   **/** /**/**   /**/ **    /** /**    /** /**/**   **/**
       **     //** /**//** ** /** /**//**  /**/ **    /** /**    /** /**//** ** /**
      /**      /** /** //***  /** /** //** /**/ **    /** /**    /** /** //***  /**
      /**      /** /**  //*   /** /**  //**/**/ **    /** /**    /** /**  //*   /**
      //**     **  /**   /    /** /**   //****/ **    /** /**    /** /**   /    /**
       //*******   /**        /** /**    //***/ /*******  //*******  /**        /**
        ///////    //         //  //      ///   ///////    ///////   //         //
    `);

    withCompile && (await compile({ force: true, quiet: true }));
    const chainName = await getChainName();

    // prepare deploy result directory structure
    await mkdir('./scripts/deployments/deployResults/managers', { recursive: true });
    await mkdir('./scripts/deployments/deployResults/subgraphManifest', { recursive: true });

    // Wrap the provider so we can override fee data as EIP-1559.
    const provider = await getSingleFallbackProvider();

    const deployer =
      chainName === 'localhost'
        ? (await ethers.getSigners())[0]
        : await new ethers.Wallet(deployerPK || process.env.OMNUUM_DEPLOYER_PRIVATE_KEY, provider);

    const walletOwnerAccounts = createWalletOwnerAccounts(
      chainName === 'localhost' ? (await ethers.getSigners()).slice(1, 6).map((x) => x.address) : DEP_CONSTANTS.wallet.ownerAddresses,
      DEP_CONSTANTS.wallet.ownerLevels,
    );
    const deployStartTime = new Date();
    console.log(`${chalk.blueBright(`START DEPLOYMENT to ${chainName} at ${deployStartTime}`)}`);

    // write tmp history file for restore already deployed history
    await tryCatch(
      () => access(prev_history_file_path),
      () =>
        writeFile(
          prev_history_file_path,
          JSON.stringify({
            deployer: deployer.address,
            solidity: {
              version: config.solidity.compilers[0].version,
            },
          }),
        ),
    );

    const { nft, nftFactory, vrfManager, mintManager, caManager, exchange, ticketManager, senderVerifier, revealManager, wallet } =
      await deployManagers({
        deploySigner: deployer,
        walletOwnerAccounts,
        signatureSignerAddress: signerAddress,
        maxFeePerGasLimit,
        gasModeAuto,
      });

    const resultData = {
      network: chainName,
      deployStartAt: deployStartTime.toLocaleTimeString(),
      deployer: deployer.address,
      caManager: structurizeProxyData(caManager),
      mintManager: structurizeProxyData(mintManager),
      exchange: structurizeProxyData(exchange),
      wallet: structurizeContractData(wallet),
      ticketManager: structurizeContractData(ticketManager),
      vrfManager: structurizeContractData(vrfManager),
      revealManager: structurizeContractData(revealManager),
      senderVerifier: structurizeContractData(senderVerifier),
      nft721: {
        impl: nft.implAddress,
        beacon: nft.beacon.address,
        address: nft.beacon.address,
      },
      nftFactory: structurizeContractData(nftFactory),
    };

    const subgraphManifestData = {
      network: chainName,
      deployStartAt: deployStartTime.toLocaleTimeString(),
      deployer: deployer.address,
      caManager: {
        address: caManager.proxyContract.address,
        startBlock: `${caManager.blockNumber}`,
      },
      mintManager: {
        address: mintManager.proxyContract.address,
        startBlock: `${mintManager.blockNumber}`,
      },
      exchange: {
        address: exchange.proxyContract.address,
        startBlock: `${exchange.blockNumber}`,
      },
      wallet: {
        address: wallet.contract.address,
        startBlock: `${wallet.blockNumber}`,
      },
      ticketManager: {
        address: ticketManager.contract.address,
        startBlock: `${ticketManager.blockNumber}`,
      },
      vrfManager: {
        address: vrfManager.contract.address,
        startBlock: `${vrfManager.blockNumber}`,
      },
      revealManager: {
        address: revealManager.contract.address,
        startBlock: `${revealManager.blockNumber}`,
      },
      senderVerifier: {
        address: senderVerifier.contract.address,
        startBlock: `${senderVerifier.blockNumber}`,
      },
      nft721: {
        impl: nft.implAddress,
        beacon: nft.beacon.address,
        startBlock: `${nft.blockNumber}`,
      },
      nftFactory: {
        address: nftFactory.contract.address,
        startBlock: `${nftFactory.blockNumber}`,
      },
    };

    const filename = `${chainName}_${getDateSuffix()}.json`;

    await rm(prev_history_file_path); // delete tmp deploy history file

    if (localSave) {
      await writeFile(`./scripts/deployments/deployResults/managers/${filename}`, JSON.stringify(resultData), 'utf8');
      await writeFile(`./scripts/deployments/deployResults/subgraphManifest/${filename}`, JSON.stringify(subgraphManifestData), 'utf-8');
    }
    if (s3Save) {
      await s3Upload({
        bucketName: 'omnuum-prod-website-resources',
        keyName: `contracts/deployments/${chainName}/${filename}`,
        fileBuffer: Buffer.from(JSON.stringify(resultData)),
      });
      await s3Upload({
        bucketName: 'omnuum-prod-website-resources',
        keyName: `contracts/deployments/subgraphManifests/${chainName}/${filename}`,
        fileBuffer: Buffer.from(JSON.stringify(subgraphManifestData)),
      });
    }

    console.log(chalk.yellowBright('\n============================ 🏁 Result Summary ============================'));
    console.dir(subgraphManifestData, { depth: 10 });
    console.log(chalk.yellowBright('================== End Of Manager Contracts Deployments ==================='));

    return resultData;
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    return null;
  }
}

// main();

module.exports = main;
