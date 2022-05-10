const { ethers } = require('ethers');
const { readFile } = require('fs/promises');
const deployed = require('../../../artifacts/contracts/V1/OmnuumExchange.sol/OmnuumExchange.json');

async function main() {
  const provider = new ethers.providers.InfuraProvider('homestead', {});

  const signer = await new ethers.Wallet('', provider);

  console.log('signer address', signer.address);

  const contract = new ethers.ContractFactory(deployed.abi, deployed.bytecode).attach('0x680756B2794B4d4Ad265040B18539f19f90F13CC');

  const tx = await contract.connect(signer).updateTmpExchangeRate('7333333333000000');

  const receipt = await tx.wait();

  console.log(receipt);
}

main();
