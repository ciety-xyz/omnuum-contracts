const { ethers } = require('hardhat');
const chalk = require('chalk');
const { getRPCProvider, createWalletOwnerAccounts, deployConsole, getChainName } = require('./deployHelper');
const DEP_CONSTANTS = require('./deployConstants');

(async () => {
  console.log(`
    **       **      **      **        **        ********  **********
    /**      /**     ****    /**       /**       /**/////  /////**///
    /**   *  /**    **//**   /**       /**       /**           /**
    /**  *** /**   **  //**  /**       /**       /*******      /**
    /** **/**/**  ********** /**       /**       /**////       /**
    /**** //**** /**//////** /**       /**       /**           /**
    /**/   ///** /**     /** /******** /******** /********     /**
    //       //  //      //  ////////  ////////  ////////      //
    `);

  console.log(`${chalk.blueBright(`START DEPLOYMENT to ${await getChainName()} at ${new Date()}`)}`);

  const OmnuumDeploySigner = await new ethers.Wallet(process.env.OMNUUM_DEPLOYER_PRIVATE_KEY, await getRPCProvider());

  const walletOwnerAccounts = createWalletOwnerAccounts(DEP_CONSTANTS.wallet.ownerAddresses, DEP_CONSTANTS.wallet.ownerLevels);

  console.log('Omnuum Owners Club\n', walletOwnerAccounts);

  const contractName = 'OmnuumWallet';

  const contractFactory = await ethers.getContractFactory(contractName);

  const contract = await contractFactory
    .connect(OmnuumDeploySigner)
    .deploy(DEP_CONSTANTS.wallet.consensusRatio, DEP_CONSTANTS.wallet.minLimitForConsensus, walletOwnerAccounts);

  const txResponse = await contract.deployed();
  const deployTxReceipt = await txResponse.deployTransaction.wait(DEP_CONSTANTS.confirmWait);
  const { gasUsed, blockNumber } = deployTxReceipt;

  deployConsole(contractName, contract.address, gasUsed, txResponse.deployTransaction.hash, blockNumber);
})();
