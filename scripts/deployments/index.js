const { ethers, config } = require('hardhat');
const { writeFile, mkdir } = require('fs/promises');
const { identity } = require('fxjs');

const { deployManagers } = require('./deployments');
const { getDateSuffix, structurizeProxyData, structurizeContractData, getChainName } = require('./deployHelper');

!(async () => {
  try {
    console.log('Start deploy');
    const [devDeployer, ownerA, ownerB, ownerC] = await ethers.getSigners();
    const { nft, vrfManager, mintManager, caManager, exchanger, ticketManager, senderVerifier, revealManager, wallet } =
      await deployManagers({ devDeployer, owners: [ownerA, ownerB, ownerC].filter(identity) });

    const resultData = {
      deployer: devDeployer.address,
      solidity: {
        version: config.solidity.compilers[0].version,
      },
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

    await mkdir('./scripts/deployments/deployResults/managers', { recursive: true });
    await writeFile(`./scripts/deployments/deployResults/managers/${filename}`, Buffer.from(JSON.stringify(resultData)), 'utf8');

    await mkdir('./scripts/deployments/deployResults/subgraphManifest', { recursive: true });
    await writeFile(
      `./scripts/deployments/deployResults/subgraphManifest/${filename}`,
      Buffer.from(JSON.stringify(subgraphManifestData)),
      'utf-8'
    );
  } catch (e) {
    console.error('\n 🚨 ==== ERROR ==== 🚨 \n', e);
  }
})();
