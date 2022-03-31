const { ethers, config } = require('hardhat');
const { writeFile, mkdir, rm, access } = require('fs/promises');

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
} = require('./deployHelper');

!(async () => {
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

    const chainName = await getChainName();
    const OMNUUM_DEPLOYER_WALLET = await new ethers.Wallet(process.env.OMNUUM_DEPLOYER_PRIVATE_KEY, await getRPCProvider(ethers.provider));

    console.log(`${chalk.blueBright(`START DEPLOYMENT to ${chainName} at ${new Date()}`)}`);

    const deploy_metadata = {
      deployer: OMNUUM_DEPLOYER_WALLET.address,
      solidity: {
        version: config.solidity.compilers[0].version,
      },
    };

    // write tmp history file for restore already deployed history
    await tryCatch(
      () => access(prev_history_file_path),
      () => writeFile(prev_history_file_path, JSON.stringify(deploy_metadata)),
    );

    const { nft, vrfManager, mintManager, caManager, exchanger, ticketManager, senderVerifier, revealManager, wallet } =
      await deployManagers({ deploySigner: OMNUUM_DEPLOYER_WALLET });

    const resultData = {
      caManager: structurizeProxyData(caManager),
      mintManager: structurizeProxyData(mintManager),
      exchanger: structurizeProxyData(exchanger),
      wallet: structurizeContractData(wallet),
      ticketManager: structurizeContractData(ticketManager),
      vrfManager: structurizeContractData(vrfManager),
      revealManager: structurizeContractData(revealManager),
      senderVerifier: structurizeContractData(senderVerifier),
      nft1155: {
        impl: nft.implAddress,
        beacon: nft.beacon.address,
      },
    };

    const subgraphManifestData = {
      network: chainName,
      caManager: {
        address: caManager.proxyContract.address,
        startBlock: `${caManager.blockNumber}`,
      },
      mintManager: {
        address: mintManager.proxyContract.address,
        startBlock: `${mintManager.blockNumber}`,
      },
      ticketManager: {
        address: ticketManager.contract.address,
        startBlock: `${ticketManager.blockNumber}`,
      },
      vrfManager: {
        address: vrfManager.contract.address,
        startBlock: `${vrfManager.blockNumber}`,
      },
      wallet: {
        address: wallet.contract.address,
        startBlock: `${wallet.blockNumber}`,
      },
    };

    const filename = `${chainName}_${getDateSuffix()}.json`;

    await mkdir('./scripts/deployments/deployResults/managers', { recursive: true });
    await writeFile(`./scripts/deployments/deployResults/managers/${filename}`, Buffer.from(JSON.stringify(resultData)), 'utf8');

    await rm(prev_history_file_path); // delete tmp deploy history file

    await mkdir('./scripts/deployments/deployResults/subgraphManifest', { recursive: true });
    await writeFile(
      `./scripts/deployments/deployResults/subgraphManifest/${filename}`,
      Buffer.from(JSON.stringify(subgraphManifestData)),
      'utf-8',
    );
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
  }
})();
