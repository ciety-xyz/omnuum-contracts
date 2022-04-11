const { ethers, upgrades, config, run } = require('hardhat');
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
  getRPCProvider,
  createWalletOwnerAccounts,
} = require('./deployHelper');
const DEP_CONSTANTS = require('./deployConstants');
const { compile } = require('../../utils/hardhat.js');

async function main(deployerPrivateKey, signatureSignerAddress) {
  try {
    console.log(`
         *******   ****     **** ****     ** **     ** **     ** ****     ****
        **/////** /**/**   **/**/**/**   /**/**    /**/**    /**/**/**   **/**
       **     //**/**//** ** /**/**//**  /**/**    /**/**    /**/**//** ** /**
      /**      /**/** //***  /**/** //** /**/**    /**/**    /**/** //***  /**
      /**      /**/**  //*   /**/**  //**/**/**    /**/**    /**/**  //*   /**
      //**     ** /**   /    /**/**   //****/**    /**/**    /**/**   /    /**
       //*******  /**        /**/**    //***//******* //******* /**        /**
        ///////   //         // //      ///  ///////   ///////  //         //
    `);

    await compile({ force: true, quiet: true });

    const chainName = await getChainName();

    // prepare deploy result directory structure
    await mkdir('./scripts/deployments/deployResults/managers', { recursive: true });
    await mkdir('./scripts/deployments/deployResults/subgraphManifest', { recursive: true });

    const OmnuumDeploySigner =
      chainName === 'localhost'
        ? (await ethers.getSigners())[0]
        : await new ethers.Wallet(deployerPrivateKey || process.env.OMNUUM_DEPLOYER_PRIVATE_KEY, await getRPCProvider(ethers.provider));

    const walletOwnerAccounts = createWalletOwnerAccounts(
      chainName === 'localhost' ? (await ethers.getSigners()).slice(1, 6).map((x) => x.address) : DEP_CONSTANTS.wallet.ownerAddresses,
      DEP_CONSTANTS.wallet.ownerLevels,
    );

    const deployStartTime = new Date();

    console.log(`${chalk.blueBright(`START DEPLOYMENT to ${chainName} at ${deployStartTime}`)}`);

    const deploy_metadata = {
      deployer: OmnuumDeploySigner.address,
      solidity: {
        version: config.solidity.compilers[0].version,
      },
    };

    // write tmp history file for restore already deployed history
    await tryCatch(
      () => access(prev_history_file_path),
      () => writeFile(prev_history_file_path, JSON.stringify(deploy_metadata)),
    );

    const { nft, nftFactory, vrfManager, mintManager, caManager, exchange, ticketManager, senderVerifier, revealManager, wallet } =
      await deployManagers({ deploySigner: OmnuumDeploySigner, walletOwnerAccounts, signatureSignerAddress });

    const resultData = {
      network: chainName,
      deployStartAt: deployStartTime,
      deployer: OmnuumDeploySigner.address,
      caManager: structurizeProxyData(caManager),
      mintManager: structurizeProxyData(mintManager),
      exchange: structurizeProxyData(exchange),
      wallet: structurizeContractData(wallet),
      ticketManager: structurizeContractData(ticketManager),
      vrfManager: structurizeContractData(vrfManager),
      revealManager: structurizeContractData(revealManager),
      senderVerifier: structurizeContractData(senderVerifier),
      nft1155: {
        impl: nft.implAddress,
        beacon: nft.beacon.address,
      },
      nftFactory: structurizeContractData(nftFactory),
    };

    const subgraphManifestData = {
      network: chainName,
      deployStartAt: deployStartTime,
      deployer: OmnuumDeploySigner.address,
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
      nft1155: {
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

    await writeFile(`./scripts/deployments/deployResults/managers/${filename}`, JSON.stringify(resultData), 'utf8');
    await rm(prev_history_file_path); // delete tmp deploy history file
    await writeFile(`./scripts/deployments/deployResults/subgraphManifest/${filename}`, JSON.stringify(subgraphManifestData), 'utf-8');

    return resultData;
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
    return null;
  }
}

// main();

module.exports = main;
