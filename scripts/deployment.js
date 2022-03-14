const { ethers } = require('hardhat');
const { deployManagers } = require('./deployManagers');
const { deployNFTProject } = require('./deployNFTProject');

!(async () => {
    const [devDeployer, userA, , ownerA, ownerB, ownerC] = await ethers.getSigners();
    const { nft, caManager, wallet } = await deployManagers({ devDeployer, owners: [ownerA, ownerB, ownerC] });
    const deployNFTResult = await deployNFTProject({
        nftBeacon: nft.beacon,
        nftContractFactory: nft.contractFactory,
        caManageProxyAddr: caManager.proxyContract.address,
        walletAddr: wallet.contract.address,
        maxSupply: 10000,
        coverUri: 'https://marpple.com',
        projectOwnerAddr: userA.address,
    });
    console.log(`NFT Project Proxy is deployed at ${deployNFTResult.contract.address} by Owner ${userA.address}`);
})();
