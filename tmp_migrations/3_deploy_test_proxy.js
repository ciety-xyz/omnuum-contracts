const { deployBeaconProxy } = require('@openzeppelin/truffle-upgrades')
const Web3 = require('web3')
const { getJSON, updateJSON } = require('../src/util.js')

const OmnuumNFT1155 = artifacts.require('OmnuumNFT1155')
const OmnuumNFT721 = artifacts.require('OmnuumNFT721')

module.exports = async function (deployer, network, accounts) {
  try {
    const address_map = await getJSON('./deployed.json')

    const testProxy1155 = await deployBeaconProxy(
      address_map.beacon1155,
      OmnuumNFT1155,
      [
        'ipfs://helloworld/',
        accounts[0],
        3,
        Web3.utils.toWei('0.01'),
        false,
        10000
      ],
      { from: accounts[1], gas: 10000000 }
    )

    const testProxy721 = await deployBeaconProxy(
      address_map.beacon721,
      OmnuumNFT721,
      [
        'ipfs://helloworld/',
        accounts[0],
        3,
        Web3.utils.toWei('0.01'),
        false,
        10000,
        'omnuum-test-pfp',
        'OTP'
      ],
      { from: accounts[1], gas: 10000000 }
    )

    console.log('fin?')

    await updateJSON('./deployed.json', {
      testProxy1155: testProxy1155.address,
      testProxy721: testProxy721.address
    })
  } catch (err) {
    console.error(err)
  }
}
