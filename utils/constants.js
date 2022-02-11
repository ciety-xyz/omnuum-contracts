const { ethers } = require('hardhat');

module.exports = {
  events: {
    NFT: {
      TransferSingle: 'TransferSingle', // address operator, address from, address to, uint256 id, uint256 value
      Ticket: 'Ticket',
      Public: 'Public',
      UriChanged: 'UriChanged',
    },
    MintManager: {
      SetFee: 'SetFee',
      Airdrop: 'Airdrop',
    },
    CAManager: {
      Updated: 'Updated',
    },
  },
  reasons: {
    common: {
      initialize: 'Initializable: contract is already initialized',
      onlyOwner: 'Ownable: caller is not the owner',
    },
    verifier: {
      nounce: 'False Nounce',
      topic: 'False Topic',
      sender: 'False Sender',
      signer: 'False Signer',
    },
    code: {
      ARG1: 'ARG1',
      ARG2: 'ARG2',
      OO1: 'OO1',
      OO2: 'OO2',
      OO3: 'OO3',
      NE1: 'NE1',
      MT1: 'MT1',
      MT2: 'MT2',
      MT5: 'MT5',
      MT3: 'MT3',
      MT7: 'MT7',
      MT8: 'MT8',
    },
  },
  payloadTopic: {
    mint: 'MINT',
    vrf: 'VRF',
    ticket: 'TICKET',
  },
  ContractTopic: {
    VRF: 'VRF',
    NFT: 'NFT',
    VERIFIER: 'VERIFIER',
    TICKETMANAGER: 'TICKETMANAGER',
    MINTMANAGER: 'MINTMANAGER',
    EXCHANGE: 'EXCHANGE',
    WALLET: 'WALLET',
    TEST: 'TEST',
    REVEAL: 'REVEAL',
  },
  chainlink: {
    mainnet: {
      LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
      COORD: '0xf0d54349aDdcf704F77AE15b96510dEA15cb7952',
      hash: '0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445',
      fee: ethers.utils.parseEther('2'),
    },
    rinkeby: {
      LINK: '0x01BE23585060835E02B77ef475b0Cc51aA1e0709',
      COORD: '0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B',
      hash: '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311',
      fee: ethers.utils.parseEther('0.1'),
    },
  },
  testValues: {
    mintFee: 2500, // 0.025 == 2.5%
  },
};
