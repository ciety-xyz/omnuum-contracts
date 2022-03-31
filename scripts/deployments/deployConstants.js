/*
 * Please check, double-check, triple-check When the time you deploy contracts to MAINNET
 * */

const { ethers } = require('hardhat');

const DEP_CONSTANTS = {
  pollingInterval: 600000,
  OmnuumDeployer: process.env.OMNUUM_DEPLOYER_PRIVATE_KEY,
  mintManager: {
    feeRate: 5000, // feeRate: 5.000 % (default)
  },
  wallet: {
    consensusRatio: 66, // ( 2 of 3 consensus ratio)
    minLimitForConsensus: 3, // (require minimum 3 votes to reach consensus)
    ownerAccounts: [
      { addr: process.env.WALLET_OWNER_A_ADDR, vote: 2 },
      { addr: process.env.WALLET_OWNER_B_ADDR, vote: 2 },
      { addr: process.env.WALLET_OWNER_C_ADDR, vote: 1 },
      { addr: process.env.WALLET_OWNER_D_ADDR, vote: 1 },
      { addr: process.env.WALLET_OWNER_E_ADDR, vote: 1 },
    ],
  },
  caManager: {
    topic: 'CAMANAGER',
  },
  vrfManager: {
    chainlink: {
      mainnet: {
        LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
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
      localhost: {
        LINK: '0x01BE23585060835E02B77ef475b0Cc51aA1e0709',
        COORD: '0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B',
        hash: '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311',
        fee: ethers.utils.parseEther('0.1'),
      },
    },
  },
  roles: {
    vrfManager: 'EXCHANGE',
    revealManager: 'VRF',
  },
};

module.exports = DEP_CONSTANTS;
