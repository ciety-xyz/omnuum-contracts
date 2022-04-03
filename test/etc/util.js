const { ethers } = require('hardhat');
const { go, filter, keys, map, object } = require('fxjs');

module.exports = {
  waitTx(sign) {
    return sign.then((tx) => tx.wait());
  },
  nullAddress: '0x0000000000000000000000000000000000000000',
  async signPayload(sender, topic, nonce, signer, verifierAddress) {
    const SIGNING_DOMAIN_NAME = 'Omnuum';
    const SIGNING_DOMAIN_VERSION = '1';

    const types = {
      Payload: [
        { name: 'sender', type: 'address' },
        { name: 'topic', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: verifierAddress,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };

    const data = { sender, topic, nonce };

    const signature = await signer._signTypedData(domain, types, data);

    return { ...data, signature };
  },
  async createTicket(data, signer, verifierAddress) {
    const SIGNING_DOMAIN_NAME = 'OmnuumTicket';
    const SIGNING_DOMAIN_VERSION = '1';

    const types = {
      Ticket: [
        { name: 'user', type: 'address' },
        { name: 'nft', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'quantity', type: 'uint32' },
        { name: 'groupId', type: 'uint256' },
      ],
    };

    const domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: verifierAddress,
      chainId: (await ethers.provider.getNetwork()).chainId,
    };

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
  parseEvent(ifaces, receipt) {
    return receipt.logs.map((log, idx) => ifaces[idx].parseLog(log));
  },
  parseStruct(struct) {
    return go(
      struct,
      keys,
      filter((k) => Number.isNaN(+k)),
      map((k) => [k, struct[k]]),
      object,
    );
  },
};
