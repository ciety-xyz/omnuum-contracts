const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { flatMap, mapC, go, range, map } = require('fxjs');
const { addDays } = require('date-fns');

const { toSolDate } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, testDeploy, deployNFT } = require('./etc/mock.js');

const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

// *Ticket Manager Contract will be removed and this feature will be replaced by off-chain lazy minting method.
describe('OmnuumTicketManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] giveTicketBatch', () => {
    it('Mint ticket for token minting', async () => {
      const {
        accounts: [, minterAC, minter2AC],
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const quantitys = [5, 3];
      const prices = [ethers.utils.parseEther('0.2'), ethers.utils.parseEther('0.3')];

      // address CA, address[] _tos, uint16[] _quantitys, uint256[]  _prices
      const tx = await omnuumTicketManager.giveTicketBatch(
        omnuumNFT1155.address,
        [minterAC.address, minter2AC.address],
        quantitys,
        prices,
        group_id,
        end_date,
      );

      // Ticket: address CA, address to, uint256 price, uint256 quantity, string actionType
      await expect(tx)
        .to.emit(omnuumTicketManager, Constants.events.NFT.Ticket)
        .withArgs(omnuumNFT1155.address, minterAC.address, quantitys[0], prices[0], group_id, 'mint');

      await expect(tx)
        .to.emit(omnuumTicketManager, Constants.events.NFT.Ticket)
        .withArgs(omnuumNFT1155.address, minter2AC.address, quantitys[1], prices[1], group_id, 'mint');
    });
    it('Mint ticket for token minting (Gas estimation - 500)', async () => {
      const { accounts, omnuumNFT1155, omnuumTicketManager } = this;

      const count = 500;

      const addresses = go(
        range(count / 100),
        flatMap(() => accounts),
        map((a) => a.address),
      );
      const quantitys = range(1, count + 1);
      const prices = go(
        range(1, count + 1),
        map((n) => n % 10),
        map((n) => ethers.utils.parseEther(`${(n * 2) / 10}`)),
      );

      // address[] _tos, uint16[] _quantitys, uint256[]  _prices
      const tx = await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, addresses, quantitys, prices, group_id, end_date);

      // Ticket: address to, uint256 price, uint256 quantity, string actionType
      await mapC(
        (idx) =>
          expect(tx)
            .to.emit(omnuumTicketManager, Constants.events.NFT.Ticket)
            .withArgs(omnuumNFT1155.address, addresses[idx], quantitys[idx], prices[idx], group_id, 'mint'),
        [0, 1, 2, count - 3, count - 2, count - 1],
      );
    }).timeout(1000 * 15);
    it('[Revert] only project owner', async () => {
      const {
        accounts: [omnuumAC, minterAC, maliciousAC, prjOwnerAC],
        omnuumTicketManager,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      await expect(
        omnuumTicketManager
          .connect(maliciousAC)
          .giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [3], [basePrice], group_id, end_date),
      ).to.be.revertedWith(Constants.reasons.code.OO1);

      // even ticket manager owner cannot access this
      await expect(
        omnuumTicketManager
          .connect(omnuumAC)
          .giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [3], [basePrice], group_id, end_date),
      ).to.be.revertedWith(Constants.reasons.code.OO1);
    });
  });

  describe('[Method] useTicket', () => {});
});
