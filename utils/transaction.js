const { ethers } = require('hardhat');
const chalk = require('chalk');
const { getWalletFromMnemonic } = require('./walletFromMnemonic.js');
const { getRPCProvider, getChainName } = require('../scripts/deployments/deployHelper.js');

async function sendMoney(toAddress, amountInEther, gasPrices) {
  try {
    let provider;
    if (gasPrices) {
      // Wrap the provider so we can override fee data.
      provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
      const FEE_DATA = {
        maxFeePerGas: ethers.utils.parseUnits(gasPrices.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.parseUnits(gasPrices.maxPriorityFeePerGas, 'gwei'),
      };
      provider.getFeeData = async () => FEE_DATA;
    } else {
      provider = await getRPCProvider(ethers.provider);
    }

    const chainName = await getChainName();

    console.log(`chainName: ${chainName}`);

    const senderSigner = chainName === 'localhost' ? (await ethers.getSigners())[0] : await getWalletFromMnemonic(provider);

    const senderAddress = await senderSigner.getAddress();

    console.log(`
    address: ${senderAddress}
    balance: ${await ethers.provider.getBalance(senderAddress)}
  `);

    const tx = await senderSigner.sendTransaction({
      to: toAddress,
      value: ethers.utils.parseEther(amountInEther),
    });

    const receipt = await tx.wait();

    const senderBalance = await senderSigner.getBalance();
    const toBalance = await provider.getBalance(toAddress);

    console.log(`Transaction Complete!

\t${chalk.green('Hash')}: ${receipt.transactionHash}
\t${chalk.green('GasUsed')}: ${receipt.gasUsed}
\t${chalk.green('BlockNumber')}: ${receipt.blockNumber}
\t${chalk.green('GasPrice')}: ${ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei')} gwei
\t${chalk.green('Value')}: ${amountInEther} ether
\t${chalk.green('Balance')}:
\t\treceiver (${ethers.utils.formatEther(toBalance.toString())} ether)
\t\tsender (${ethers.utils.formatEther(senderBalance.toString())} ether)

`);
  } catch (err) {
    console.error(err);
  }
}

// sendMoney('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', '100');
// sendMoney('0x8a54AaBCccf6299f138Ff3cabe6F637716449EB4', '0.15');
