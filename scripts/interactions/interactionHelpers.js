const ethers = require('hardhat');
const { ifElse, identity } = require('fxjs');
const { getChainId } = require('../deployments/deployHelper');

const getPayloadTypedData = async ({ senderVerifierAddress, minterAddress, payloadTopic, groupId }) => ({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Payload: [
      { name: 'sender', type: 'address' },
      { name: 'topic', type: 'string' },
      { name: 'nonce', type: 'uint256' },
    ],
  },
  primaryType: 'Payload',
  domain: {
    name: 'Omnuum',
    version: '1',
    verifyingContract: senderVerifierAddress,
    chainId: await getChainId(),
  },
  message: {
    sender: minterAddress,
    topic: payloadTopic,
    nonce: groupId,
  },
});

const getTicketTypedDate = async ({ ticketManagerAddress, minterAddress, nftContractAddress, groupId, ether_price, quantity }) => {
  const ethPrice = ethers.utils.parseEther(`${ether_price}`);
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Ticket: [
        { name: 'user', type: 'address' },
        { name: 'nft', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'quantity', type: 'uint32' },
        { name: 'groupId', type: 'uint256' },
      ],
    },
    primaryType: 'Ticket',
    domain: {
      name: 'OmnuumTicket',
      version: '1',
      verifyingContract: ticketManagerAddress,
      chainId: await getChainId(),
    },
    message: {
      user: minterAddress,
      nft: nftContractAddress,
      groupId,
      price: ethPrice,
      quantity,
    },
  };
};

const getTicketWithSignature = async ({
  ticketManagerAddress,
  minterAddress,
  nftContractAddress,
  groupId,
  ether_price,
  quantity,
  signerPrivateKey,
}) => {
  const ticketTypedData = await getTicketTypedDate({
    ticketManagerAddress,
    minterAddress,
    nftContractAddress,
    groupId,
    ether_price,
    quantity,
  });
  const { signingEIP712 } = await import('@marpple/omnuum-digitalSigning');
  const { signature } = signingEIP712({
    typedData: ticketTypedData,
    privateKey: signerPrivateKey,
  });

  return { ...ticketTypedData.message, signature };
};

const getPayloadWithSignature = async ({ senderVerifierAddress, minterAddress, payloadTopic, groupId, signerPrivateKey }) => {
  const { signingEIP712 } = await import('@marpple/omnuum-digitalSigning');

  const payloadTypedData = await getPayloadTypedData({ senderVerifierAddress, minterAddress, payloadTopic, groupId });

  const { signature } = signingEIP712({
    typedData: payloadTypedData,
    privateKey: ifElse(
      (key) => /^0x/.test(key),
      (key) => key.slice(2),
      identity,
    )(signerPrivateKey),
  });

  return { ...payloadTypedData.message, signature };
};

module.exports = { getTicketWithSignature, getPayloadWithSignature };
