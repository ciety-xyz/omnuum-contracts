const { ethers } = require('hardhat');
const fs = require('fs');

const { deployManagers } = require('./deployments');
const { getDateSuffix, structurizeProxyData, structurizeContractData } = require('./deployHelper');

!(async () => {
  const [devDeployer, ownerA, ownerB, ownerC] = await ethers.getSigners();
  const { nft, vrfManager, mintManager, caManager, exchanger, ticketManager, senderVerifier, revealManager, wallet } = await deployManagers(
    { devDeployer, owners: [ownerA, ownerB, ownerC] }
  );

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

  fs.writeFileSync(
    `./scripts/deployments/deployResults/chain-${ethers.provider.network.chainId}_deployedAt-${getDateSuffix()}.json`,
    Buffer.from(JSON.stringify(resultData)),
    'utf-8'
  );
})();
