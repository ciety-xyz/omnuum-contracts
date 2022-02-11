const { ethers } = require('hardhat');

module.exports = {
  waitTx(sign) {
    return sign.then((tx) => tx.wait());
  },
  nullAddress: '0x0000000000000000000000000000000000000000',
  async signPayload(sender, topic, nounce, signer, verifierAddress) {
    const SIGNING_DOMAIN_NAME = 'Omnuum';
    const SIGNING_DOMAIN_VERSION = '1';

    const types = {
      Payload: [
        { name: 'sender', type: 'address' },
        { name: 'topic', type: 'string' },
        { name: 'nounce', type: 'uint32' },
      ],
    };

    const domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: verifierAddress,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };

    const data = { sender, topic, nounce };

    const signature = await signer._signTypedData(domain, types, data);

    return { ...data, signature };
  },
  async isLocalNetwork(provider) {
    const { chainId } = await provider.getNetwork();
    return chainId != 1 && chainId != 4;
  },
  calcGasFeeInEther(receipt) {
    return receipt.gasUsed.mul(receipt.effectiveGasPrice);
  },
  toSolDate(date) {
    return Math.floor(date / 1000);
  },
};
