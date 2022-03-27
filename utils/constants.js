const { ethers } = require('hardhat');

module.exports = {
  events: {
    NFT: {
      TransferSingle: 'TransferSingle', // address operator, address from, address to, uint256 id, uint256 value
      Ticket: 'Ticket',
      Public: 'Public',
      Uri: 'Uri',
    },
    MintManager: {
      SetDiscountRate: 'SetDiscountRate',
      ChangeBaseFeeRate: 'ChangeBaseFeeRate',
      Airdrop: 'Airdrop',
      SetSchedule: 'SetSchedule',
      PublicMint: 'PublicMint',
    },
    CAManager: {
      Updated: 'Updated',
    },
    TicketManager: {
      EndDate: 'EndDate',
      UseTicket: 'UseTicket',
    },
    VRFManager: {
      RequestVRF: 'RequestVRF',
      ResponseVRF: 'ResponseVRF',
      Updated: 'Updated',
    },
    Wallet: {
      FeeReceived: 'FeeReceived',
      Requested: 'Requested',
      Approved: 'Approved',
      Revoked: 'Revoked',
      Withdrawn: 'Withdrawn',
    },
  },
  reasons: {
    common: {
      initialize: 'Initializable: contract is already initialized',
      onlyOwner: 'Ownable: caller is not the owner',
    },
    senderVerifier: {
      nounce: 'False Nounce',
      topic: 'False Topic',
      sender: 'False Sender',
      signer: 'False Signer',
    },
    ticketManager: {
      signer: 'False Signer',
      nft: 'False NFT',
      minter: 'False Minter',
    },
    vrfManager: {
      LINK: 'Not enough LINK',
      Ether: 'Not enough Ether',
      Once: 'Already used',
    },
    RevertMessage: {
      silent: 'Transaction reverted silently',
    },
    wallet: {
      onlyOwner: 'only owner',
      reqNotExists: 'request not exist',
      alreadyApproved: 'already approved',
      notApproved: 'not approved',
      alreadyWithdrawn: 'already withdrawn',
      consensusNotReached: 'consensus not reached',
      notEnoughBalance: 'request value exceeds balance',
      notRequester: 'withdrawer must be the requester',
    },
    caManager: {
      notCA: 'Not CA',
    },
    code: {
      ARG1: 'ARG1',
      ARG2: 'ARG2',
      OO1: 'OO1',
      OO2: 'OO2',
      OO3: 'OO3',
      NE1: 'NE1', // Fee rate should be lower than 100%
      MT1: 'MT1', // There is no available ticket
      MT2: 'MT2', // Cannot mint more than possible amount per address
      MT3: 'MT3', // Remaining token count is not enough
      MT5: 'MT5', // Not enough money
      MT7: 'MT7', // Mint is ended
      MT8: 'MT8', // Minting period is ended
      MT9: 'MT9', // Mint subject cannot be CA
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
    TICKET: 'TICKET',
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
    baseFeeRate: 5000, // converted as 0.05 (5 percent)
    discountFeeRate: 10000, // converted as 0.1 (10 percent)
    walletOwnersLen: 3,
    sendEthValue: '10',
    mintFee: 2500, // 0.025 == 2.5%
    coverUri: 'https://testCover.com',
    tmpExchangeRate: ethers.utils.parseEther('0.0055'),
  },
};
