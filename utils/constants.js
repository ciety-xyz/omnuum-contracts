const { ethers } = require('hardhat');

module.exports = {
  events: {
    NFT: {
      Transfer: 'Transfer', // address indexed from, address indexed to, uint256 indexed tokenId
      Ticket: 'Ticket',
      Public: 'Public',
      BaseURIChanged: 'BaseURIChanged',
      BalanceTransferred: 'BalanceTransferred',
      EtherReceived: 'EtherReceived',
      Revealed: 'Revealed',
    },
    MintManager: {
      SetSpecialFeeRate: 'SetSpecialFeeRate',
      ChangeFeeRate: 'ChangeFeeRate',
      Airdrop: 'Airdrop',
      SetPublicSchedule: 'SetPublicSchedule',
      PublicMint: 'PublicMint',
      SetMinFee: 'SetMinFee',
    },
    CAManager: {
      RoleAdded: 'RoleAdded',
      RoleRemoved: 'RoleRemoved',
      ContractRegistered: 'ContractRegistered',
      ContractRemoved: 'ContractRemoved',
      NftContractRegistered: 'NftContractRegistered',
    },
    TicketManager: {
      SetTicketSchedule: 'SetTicketSchedule',
      TicketMint: 'TicketMint',
    },
    VRFManager: {
      RequestVRF: 'RequestVRF',
      ResponseVRF: 'ResponseVRF',
      Updated: 'Updated',
    },
    Wallet: {
      PaymentReceived: 'PaymentReceived',
      EtherReceived: 'EtherReceived',
      Requested: 'Requested',
      Approved: 'Approved',
      Revoked: 'Revoked',
      Canceled: 'Canceled',
      Executed: 'Executed',
    },
  },
  reasons: {
    common: {
      initialize: 'Initializable: contract is already initialized',
      onlyOwner: 'Ownable: caller is not the owner',
      notTokenOwnerOrApproved: 'ERC721Burnable: caller is not owner nor approved'
    },
    RevertMessage: {
      silent: 'Transaction reverted silently',
    },
    code: {
      // Arguments Error
      ARG1: 'ARG1', // Arguments length should be same
      ARG2: 'ARG2', // Arguments are not correct
      ARG3: 'ARG3', // Not enough ether sent
      // Only Owner Error
      OO1: 'OO1', // Ownable: Caller is not the collection owner
      OO2: 'OO2', // Only Omnuum or owner can change
      OO3: 'OO3', // Only Omnuum can call
      OO4: 'OO4', // Only the owner of the wallet is allowed
      OO5: 'OO5', // Already the owner of the wallet
      OO6: 'OO6', // Only the requester is allowed
      OO7: 'OO7', // Only role owner can access
      c: 'OO8', // Only reveal manager allowed
      // Not Exist Error
      NX1: 'NX1', // ERC721Metadata: URI query for nonexistent token
      NX2: 'NX2', // Non-existent wallet account
      NX3: 'NX3', // Non-existent owner request
      NX4: 'NX4', // Non-existent role to CA
      // Number Error
      NE1: 'NE1', // Fee rate should be lower than 100%
      NE2: 'NE2', // Not reach consensus
      NE3: 'NE3', // A zero payment is not acceptable
      NE4: 'NE4', // Insufficient balance
      NE5: 'NE5', // Violate min limit for consensus
      // State Error
      SE1: 'SE1', // Already executed
      SE2: 'SE2', // Request canceled
      SE3: 'SE3', // Already voted
      SE4: 'SE4', // Not voted
      SE5: 'SE5', // Address: unable to send value, recipient may have reverted
      SE6: 'SE6', // NFT already revealed
      SE7: 'SE7', // Not enough LINK at exchange contract
      SE8: 'SE8', // Already used address
      // Mint Error
      MT1: 'MT1', // There is no available ticket
      MT2: 'MT2', // Cannot mint more than possible amount per address
      MT3: 'MT3', // Remaining token count is not enough
      MT5: 'MT5', // Not enough money
      MT7: 'MT7', // Mint is ended
      MT8: 'MT8', // Minting period is ended
      MT9: 'MT9', // Minter cannot be CA
      // Address Error
      AE1: 'AE1', // Zero address not acceptable
      AE2: 'AE2', // Contract address not acceptable
      // Verification Error
      VR1: 'VR1', // False Signer
      VR2: 'VR2', // False Nonce
      VR3: 'VR3', // False Topic
      VR4: 'VR4', // False Sender
      VR5: 'VR5', // False NFT
      VR6: 'VR6', // False Minter
    },
  },
  contractRole: {
    exchange: 'EXCHANGE',
    vrf: 'VRF',
  },
  payloadTopic: {
    mint: 'MINT',
    ticket: 'TICKET',
    deployCol: 'DEPLOY_COL',
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
    CAMANAGER: 'CAMANAGER',
    NFTFACTORY: 'NFTFACTORY',
  },
  vrfTopic: {
    REVEAL_PFP: 'REVEAL_PFP',
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
    paymentTarget: '0x0000000000000000DEad0000000000000000DEad',
    paymentDescription: 'Test for Payment',
    paymentTestTopic: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('TEST')),
    zeroOwnerAccount: { addr: ethers.constants.AddressZero, vote: 0 },
    feeRate: 5000, // converted as 0.05 (5 percent)
    specialFeeRate: 10000, // converted as 0.1 (10 percent)
    walletOwnersLen: 3,
    minFee: ethers.utils.parseEther('0.0005'),
    sendEthValue: '10',
    consensusRatio: 55,
    minLimitForConsensus: 3,
    mintFee: 2500, // 0.025 == 2.5%
    coverUri: 'https://cover.com/',
    baseURI: 'https://reveal.com/',
    tmpLinkExRate: ethers.utils.parseEther('0.01466666666'),
    collectionId: 71,
    name: 'hello',
    symbol: 'WRD',
  },
};
