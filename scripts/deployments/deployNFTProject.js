const { upgrades } = require('hardhat');

module.exports.deployNFTProject = async ({
  nftBeacon,
  nftContractFactory,
  caManageProxyAddr,
  walletAddr,
  maxSupply,
  coverUri,
  projectOwnerAddr,
}) => {
  /* Deploy NFT1155 Beacon Proxy */
  const nftBeaconProxy = await upgrades.deployBeaconProxy(nftBeacon, nftContractFactory, [
    caManageProxyAddr,
    walletAddr,
    maxSupply,
    coverUri,
    projectOwnerAddr,
  ]);
  const deployReceipt = await nftBeaconProxy.deployed();
  return { beaconProxy: nftBeaconProxy, deployReceipt };
};
