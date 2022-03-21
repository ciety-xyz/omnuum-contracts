const inquirer = require('inquirer');
const { ethers } = require('hardhat');
const fs = require('fs');
const { deployNFTProject } = require('../deployNFTProject');
const { getDateSuffix, nullCheck, getRPCProvider } = require('../deployHelper');

const OmnuumCAManagerAbi = require('../../../data/abi/OmnuumCAManager.json');
const OmnuumWalletAbi = require('../../../data/abi/OmnuumWallet.json');
const { feeTopic } = require('../../../utils/constants');

const inquirerParams = {
  nft_beacon_address: 'nft_beacon_address',
  ca_manager_proxy_address: 'ca_manager_proxy_address',
  wallet_address: 'wallet_address',
  max_supply: 'max_supply',
  cover_uri: 'cover_url',
  project_owner_private_key: 'project_owner_private_key',
  payment_value: 'payment_value',
  nft_collection_id: 'nft_collection_id',
};

const questions = [
  {
    name: inquirerParams.payment_value,
    type: 'input',
    message: '🤔 Cost of deployment is (in gwei)...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_collection_id,
    type: 'input',
    message: '🤔 nft_collection_id is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.nft_beacon_address,
    type: 'input',
    message: '🤔 Your nft beacon address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.project_owner_private_key,
    type: 'input',
    message: '🤔 project_owner_private_key is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.ca_manager_proxy_address,
    type: 'input',
    message: '🤔 Your ca_manager_proxy_address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.wallet_address,
    type: 'input',
    message: '🤔 Your wallet_address is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.max_supply,
    type: 'input',
    message: '🤔 max_supply is...',
    validate: nullCheck,
  },
  {
    name: inquirerParams.cover_uri,
    type: 'input',
    message: '🤔 cover_uri is...',
    validate: nullCheck,
  },
];

(async () => {
  inquirer.prompt(questions).then(async (ans) => {
    const caManagerAddress = `${ans[inquirerParams.ca_manager_proxy_address]}`;
    const walletAddress = `${ans[inquirerParams.wallet_address]}`;
    const nftContractFactory = await ethers.getContractFactory('OmnuumNFT1155');

    const provider = await getRPCProvider(ethers.provider);
    const deployerSigner = new ethers.Wallet(process.env.ACCOUNT_DEV_DEPLOYER, provider);
    const deployerAddress = await deployerSigner.getAddress();
    const projectOwnerSigner = new ethers.Wallet(`${ans[inquirerParams.project_owner_private_key]}`, provider);
    const projectOwnerAddress = projectOwnerSigner.address;

    const caManager = new ethers.Contract(caManagerAddress, OmnuumCAManagerAbi, deployerSigner);
    const wallet = new ethers.Contract(walletAddress, OmnuumWalletAbi, deployerSigner);

    const deployPayment = {
      topic: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(feeTopic.deploy)),
      description: `${ans[inquirerParams.nft_collection_id]}`, // collection_id for deployment
      value: { value: ethers.utils.parseUnits(`${ans[inquirerParams.payment_value]}`, 'gwei') },
    };

    await (
      await wallet.connect(projectOwnerSigner).makePayment(deployPayment.topic, deployPayment.description, deployPayment.value)
    ).wait();
    console.log(
      `🌹 NFT deploy fee is paid with collection_id: ${ans[inquirerParams.nft_collection_id]} amount: ${
        ans[inquirerParams.payment_value]
      }\n`
    );
    const deployNFTProjectResult = await deployNFTProject({
      nftBeacon: `${ans[inquirerParams.nft_beacon_address]}`,
      nftContractFactory,
      caManageProxyAddr: ans[inquirerParams.ca_manager_proxy_address],
      devDeployerAddr: deployerAddress,
      maxSupply: ans[inquirerParams.max_supply],
      coverUri: `${ans[inquirerParams.cover_uri]}`,
      projectOwnerAddr: projectOwnerAddress,
    });
    console.log(`🌹 NFT Project Proxy is deployed at ${deployNFTProjectResult.beaconProxy.address} by Owner ${projectOwnerAddress}\n`);

    // register NFT beacon proxy contract to CA manager

    const txRegister = await caManager.registerNftContract(deployNFTProjectResult.beaconProxy.address, projectOwnerAddress);
    const deployReceipt = await txRegister.wait();

    console.log(deployReceipt);

    fs.writeFileSync(
      `./scripts/deployments/deployNFTResults/chain-${ethers.provider.network.chainId}_deployedAt-${getDateSuffix()}.json`,
      Buffer.from(
        JSON.stringify({
          nftProject: { beaconProxy: deployNFTProjectResult.beaconProxy.address, owner: projectOwnerAddress },
        })
      ),
      'utf-8'
    );
  });
})();
