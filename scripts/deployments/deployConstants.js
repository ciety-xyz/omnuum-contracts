/*
 * Please check, double-check, triple-check When the time you deploy contracts to MAINNET
 * */

const { ethers } = require('hardhat');

const DEP_CONSTANTS = {
  confirmWait: 1,
  pollingInterval: 600000,
  OmnuumDeployer: process.env.OMNUUM_DEPLOYER_PRIVATE_KEY,
  mintManager: {
    feeRate: 5000, // feeRate: 5.000 % (default)
  },
  wallet: {
    consensusRatio: 55,
    minLimitForConsensus: 3,
    ownerLevels: [2, 2, 1, 1, 1],
    ownerAddresses: [
      process.env.WALLET_OWNER_A_ADDR,
      process.env.WALLET_OWNER_B_ADDR,
      process.env.WALLET_OWNER_C_ADDR,
      process.env.WALLET_OWNER_D_ADDR,
      process.env.WALLET_OWNER_E_ADDR,
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
      goerli: {
        LINK: '0x01BE23585060835E02B77ef475b0Cc51aA1e0709',
        COORD: '0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B',
        hash: '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311',
        fee: ethers.utils.parseEther('0.1'),
      }, // goerli 를 지원하지 않고 있음. (일단 rinkeby 와 동일하게 추가)
      matic: {
        LINK: '0xb0897686c545045aFc77CF20eC7A532E3120E0F1',
        COORD: '0x3d2341ADb2D31f1c5530cDC622016af293177AE0',
        hash: '0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da',
        fee: ethers.utils.parseEther('0.0001'),
      },
      mumbai: {
        LINK: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB',
        COORD: '0x8C7382F9D8f56b33781fE506E897a4F1e2d17255',
        hash: '0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4',
        fee: ethers.utils.parseEther('0.0001'),
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
    EXCHANGE: 'EXCHANGE',
    VRF: 'VRF',
  },
};

module.exports = DEP_CONSTANTS;
