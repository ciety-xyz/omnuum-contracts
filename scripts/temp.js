import { bcAsset } from 'assetmanagement';

(async () => {
  try {
    const res = await bcAsset.checkERCInterfaces([
      {
        tag: 'LINK',
        contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        chain: 'EthereumMainnet',
      },
    ]);
    console.log(res);
  } catch (e) {
    console.error(e);
  }
})();
