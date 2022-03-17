const { ethers } = require('hardhat');
const fs = require('fs');

const { deployManagers } = require('./deployManagers');
const { deployNFTProject } = require('./deployNFTProject');

const structurizeProxyData = (deployObj) => ({
  proxy: deployObj.proxyContract.address,
  impl: deployObj.implAddress,
  admin: deployObj.adminAddress,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
});

const structurizeContractData = (deployObj) => ({
  contract: deployObj.contract.address,
  gasUsed: ethers.BigNumber.from(deployObj.gasUsed).toNumber(),
});

const getDateSuffix = () =>
  `${new Date().toLocaleDateString().replaceAll('/', '-')}_${new Date().toLocaleTimeString('en', { hour12: false })}`;

!(async () => {
  const [devDeployer, userA, , ownerA, ownerB, ownerC] = await ethers.getSigners();
  const { nft, vrfManager, mintManager, caManager, exchanger, ticketManager, senderVerifier, revealManager, wallet } = await deployManagers(
    { devDeployer, owners: [ownerA, ownerB, ownerC] },
  );

  const NFT_PRJ_OWNER = userA.address;
  const deployNFTProjectResult = await deployNFTProject({
    nftBeacon: nft.beacon,
    nftContractFactory: nft.contractFactory,
    caManageProxyAddr: caManager.proxyContract.address,
    walletAddr: wallet.contract.address,
    maxSupply: 10000,
    coverUri: 'https://marpple.com',
    projectOwnerAddr: NFT_PRJ_OWNER,
  });
  console.log(`🌹 NFT Project Proxy is deployed at ${deployNFTProjectResult.beaconProxy.address} by Owner ${NFT_PRJ_OWNER}\n`);

  // register NFT beacon proxy contract to CA manager
  await (await caManager.proxyContract.registerNftContract(deployNFTProjectResult.beaconProxy.address)).wait();

  const resultData = {
    deployer: devDeployer.address,
    caManager: structurizeProxyData(caManager),
    mintManager: structurizeProxyData(mintManager),
    exchanger: structurizeProxyData(exchanger),
    ticketManager: structurizeContractData(ticketManager),
    vrfManager: structurizeContractData(vrfManager),
    revealManager: structurizeContractData(revealManager),
    senderVerifier: structurizeContractData(senderVerifier),
    wallet: structurizeContractData(wallet),
    nft1155: {
      Impl: nft.implAddress,
      beacon: nft.beacon.address,
    },
    nftProject: {
      beaconProxy: deployNFTProjectResult.beaconProxy.address,
      owner: NFT_PRJ_OWNER,
    },
  };

  fs.writeFileSync(
    `./scripts/deployments/deployResults/chain-${ethers.provider.network.chainId}_deployedAt-${getDateSuffix()}.json`,
    Buffer.from(JSON.stringify(resultData)),
    'utf-8',
  );
})();
