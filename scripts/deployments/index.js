const { ethers } = require('hardhat');
const fs = require('fs');

const { deployManagers } = require('./deployments');
const { getDateSuffix, structurizeProxyData, structurizeContractData, getChainName } = require('./deployHelper');

!(async () => {
  try {
    const [devDeployer, ownerA, ownerB, ownerC] = await ethers.getSigners();
    const { nft, vrfManager, mintManager, caManager, exchanger, ticketManager, senderVerifier, revealManager, wallet } =
      await deployManagers({ devDeployer, owners: [ownerA, ownerB, ownerC] });

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
    };

    const chainName = await getChainName();

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
    fs.writeFileSync(`./scripts/deployments/deployResults/managers/${filename}`, Buffer.from(JSON.stringify(resultData)), 'utf-8');
    fs.writeFileSync(
      `./scripts/deployments/deployResults/subgraphManifest/${filename}`,
      Buffer.from(JSON.stringify(subgraphManifestData)),
      'utf-8'
    );
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
  }
})();
