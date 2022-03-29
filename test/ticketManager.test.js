const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { addDays } = require('date-fns');

const { toSolDate, createTicket, signPayload } = require('./etc/util.js');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, prepareMockDeploy, testDeploy } = require('./etc/mock.js');

const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;
const nonce = 0;

upgrades.silenceWarnings();

// *Ticket Manager Contract will be removed and this feature will be replaced by off-chain lazy minting method.
describe('TicketManager', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] setEndDate', () => {
    it('Should set end date', async () => {
      const { ticketManager, omnuumNFT1155 } = this;

      const tx = await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date);

      await tx.wait();

      await expect(tx).to.emit(ticketManager, Constants.events.TicketManager.EndDate).withArgs(omnuumNFT1155.address, group_id, end_date);
    });
    it('[Revert] not owner of NFT', async () => {
      const {
        ticketManager,
        omnuumNFT1155,
        accounts: [, maliciousAC],
      } = this;

      await expect(ticketManager.connect(maliciousAC).setEndDate(omnuumNFT1155.address, group_id, end_date)).to.be.revertedWith(
        Constants.reasons.code.OO1,
      );
    });
  });

  describe('[Method] verify', () => {
    it('Should verified as success', async () => {
      const {
        ticketManager,
        mockNFT,
        accounts: [omnuumAC, minterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 10;

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: mockNFT.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(mockNFT.address, group_id, end_date)).wait();

      // signer, minter, quantity, ticket
      await ticketManager.verify(omnuumAC.address, mockNFT.address, minterAC.address, quantity, ticket);
    });
    it('[Revert] expired ticket', async () => {
      const {
        ticketManager,
        mockNFT,
        accounts: [omnuumAC, minterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 10;
      const immediate_end_date = toSolDate(+new Date() + 3000);

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: mockNFT.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(mockNFT.address, group_id, immediate_end_date)).wait();

      await expect(ticketManager.verify(omnuumAC.address, mockNFT.address, minterAC.address, quantity, ticket)).to.be.revertedWith(
        Constants.reasons.code.MT8,
      );
    }).timeout(5000);
    it('[Revert] False Signer', async () => {
      const {
        ticketManager,
        mockNFT,
        accounts: [omnuumAC, minterAC, fakeSignerAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 10;

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: mockNFT.address,
          groupId: group_id,
          price,
          quantity,
        },
        fakeSignerAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(mockNFT.address, group_id, end_date)).wait();

      await expect(ticketManager.verify(omnuumAC.address, mockNFT.address, minterAC.address, quantity, ticket)).to.be.revertedWith(
        Constants.reasons.code.VR1,
      );
    });
    it('[Revert] False NFT', async () => {
      const {
        ticketManager,
        omnuumNFT1155,
        mockNFT,
        accounts: [omnuumAC, minterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 10;

      // omnuumNFT1155 <-> mockNFT
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: omnuumNFT1155.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(mockNFT.address, group_id, end_date)).wait();

      await expect(ticketManager.verify(omnuumAC.address, mockNFT.address, minterAC.address, quantity, ticket)).to.be.revertedWith(
        Constants.reasons.code.VR5,
      );
    });
    it('[Revert] False Minter', async () => {
      const {
        ticketManager,
        mockNFT,
        accounts: [omnuumAC, minterAC, fakeMinterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 10;

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: mockNFT.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(mockNFT.address, group_id, end_date)).wait();

      await expect(ticketManager.verify(omnuumAC.address, mockNFT.address, fakeMinterAC.address, quantity, ticket)).to.be.revertedWith(
        Constants.reasons.code.VR6,
      );
    });
  });

  describe('[Method] useTicket', () => {
    it('Can use ticket for mint', async () => {
      const {
        omnuumNFT1155,
        ticketManager,
        senderVerifier,
        accounts: [omnuumAC, minterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 20;
      const use_quantity = 15;

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: omnuumNFT1155.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, nonce, omnuumAC, senderVerifier.address);

      const tx1 = await omnuumNFT1155.connect(minterAC).ticketMint(use_quantity, ticket, payload, {
        value: price.mul(use_quantity),
      });
      await expect(tx1)
        .to.emit(ticketManager, Constants.events.TicketManager.UseTicket)
        .withArgs(omnuumNFT1155.address, minterAC.address, use_quantity, [
          ticket.user,
          ticket.nft,
          ticket.price,
          ticket.quantity,
          ticket.groupId,
        ]);
    });
    it('[Revert] Cannot mint more than remaining quantity', async () => {
      const {
        omnuumNFT1155,
        ticketManager,
        senderVerifier,
        accounts: [omnuumAC, minterAC],
      } = this;

      const price = ethers.utils.parseEther('0.1');
      const quantity = 20;
      const use_quantity1 = 15;
      const fail_quantity1 = 6;
      const use_quantity2 = 5;
      const fail_quantity2 = 1;

      // give Ticket to minter
      const ticket = await createTicket(
        {
          user: minterAC.address,
          nft: omnuumNFT1155.address,
          groupId: group_id,
          price,
          quantity,
        },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, nonce, omnuumAC, senderVerifier.address);

      const tx1 = await omnuumNFT1155.connect(minterAC).ticketMint(use_quantity1, ticket, payload, {
        value: price.mul(use_quantity1),
      });

      await expect(tx1)
        .to.emit(ticketManager, Constants.events.TicketManager.UseTicket)
        .withArgs(omnuumNFT1155.address, minterAC.address, use_quantity1, [
          ticket.user,
          ticket.nft,
          ticket.price,
          ticket.quantity,
          ticket.groupId,
        ]);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(fail_quantity1, ticket, payload, {
          value: price.mul(fail_quantity1),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      const tx2 = await omnuumNFT1155.connect(minterAC).ticketMint(use_quantity2, ticket, payload, {
        value: price.mul(use_quantity2),
      });

      await expect(tx2)
        .to.emit(ticketManager, Constants.events.TicketManager.UseTicket)
        .withArgs(omnuumNFT1155.address, minterAC.address, use_quantity2, [
          ticket.user,
          ticket.nft,
          ticket.price,
          ticket.quantity,
          ticket.groupId,
        ]);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(fail_quantity2, ticket, payload, {
          value: price.mul(fail_quantity2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });
});
