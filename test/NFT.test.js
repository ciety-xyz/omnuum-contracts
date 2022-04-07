const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { delay } = require('fxjs');
const { addDays } = require('date-fns');
const Constants = require('../utils/constants.js');
require('chai').should();

const { createNftContractArgs, prepareDeploy, testDeploy, deployNFT, prepareMockDeploy } = require('./etc/mock.js');
const { signPayload, nullAddress, toSolDate, calcGasFeeInEther, createTicket } = require('./etc/util.js');
const { reasons, events } = require('../utils/constants');

const nonce = 1;
const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

describe('OmnuumNFT', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('Security', () => {
    it('[Revert] Should not initialize after deploy', async () => {
      const { accounts, omnuumNFT1155 } = this;

      const defaultArgs = createNftContractArgs(this, { caManagerAddress: this.omnuumCAManager.address });

      await expect(
        omnuumNFT1155
          .connect(accounts[0])
          .initialize(
            defaultArgs.caManagerAddress,
            defaultArgs.omnuumAddress,
            defaultArgs.maxSupply,
            defaultArgs.coverUri,
            defaultArgs.prjOwner,
          ),
      ).to.be.revertedWith(Constants.reasons.common.initialize);
    });
  });

  describe('[Method] Public Mint', () => {
    it('Public mint', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).publicMint(2, group_id, payload, {
        value: basePrice.mul(2),
      });

      await expect(tx)
        .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
        .withArgs(minterAC.address, nullAddress, minterAC.address, 1, 1);

      await expect(tx)
        .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
        .withArgs(minterAC.address, nullAddress, minterAC.address, 2, 1);
    });
    it('Omnuum should receive fee when mint success', async () => {
      const walletAddress = this.omnuumWallet.address;

      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.2');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 2;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const prev_bal = await ethers.provider.getBalance(walletAddress);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await (
        await omnuumNFT1155.connect(minterAC).publicMint(quantity, group_id, payload, {
          value: basePrice.mul(quantity),
        })
      ).wait();

      const payment = basePrice.mul(quantity);

      const mint_fee = payment.mul(Constants.testValues.feeRate).div(10 ** 5);

      const cur_bal = await ethers.provider.getBalance(walletAddress);

      expect(cur_bal).to.equal(prev_bal.add(mint_fee));
    });
    it('Omnuum should receive fee when mint success with special fee rate', async () => {
      const walletAddress = this.omnuumWallet.address;

      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.2');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 1;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      await omnuumMintManager.setSpecialFeeRate(omnuumNFT1155.address, Constants.testValues.specialFeeRate);

      const prev_bal = await ethers.provider.getBalance(walletAddress);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await (
        await omnuumNFT1155.connect(minterAC).publicMint(quantity, group_id, payload, {
          value: basePrice.mul(quantity),
        })
      ).wait();

      const payment = basePrice.mul(quantity);

      const mint_fee = payment.mul(Constants.testValues.specialFeeRate).div(10 ** 5);

      const cur_bal = await ethers.provider.getBalance(walletAddress);

      expect(cur_bal).to.equal(prev_bal.add(mint_fee));
    });
    it('[Revert] Prevent CA call to mint', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
        mockNFT,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      // mint through CA
      await expect(
        mockNFT.publicContractMint(omnuumNFT1155.address, 2, group_id, payload, {
          value: basePrice.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT9);
    });
    it('[Revert] Payload authenticate fail - (sender, signer)', async () => {
      const {
        accounts: [omnuumAC, minterAC, maliciousAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      // CASE1: valid payload, but malicious sender
      await expect(
        omnuumNFT1155.connect(maliciousAC).publicMint(2, group_id, payload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR4);

      // CASE2: invalid signer
      const invalidSignedPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.mint,
        group_id,
        maliciousAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(maliciousAC).publicMint(2, group_id, invalidSignedPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR1);
    });
    it('[Revert] Cannot mint as public after public mint schedule ended', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          immediate_end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      // wait 3 second for expire
      await delay(3000, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).publicMint(2, group_id, payload, {
          value: basePrice.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 2;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).publicMint(quantity, group_id, payload, {
          value: basePrice.mul(quantity).div(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] Cannot mint more quantity than max quantity per address (public)', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).publicMint(max_min_per_address + 1, group_id, payload, {
          value: basePrice.mul(max_min_per_address + 1),
        }),
      ).revertedWith(Constants.reasons.code.MT2);
    });
    it('[Revert] Remaining public mint amount is not enough', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumMintManager,
      } = this;
      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 3000;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT1155.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).publicMint(open_quantity + 2, group_id, payload, {
          value: basePrice.mul(open_quantity + 2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  describe('[Method] ticketMint', () => {
    it('Mint with ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).ticketMint(2, ticket, payload, {
        value: price.mul(2),
      });

      await expect(tx)
        .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
        .withArgs(minterAC.address, nullAddress, minterAC.address, 1, 1);

      await expect(tx)
        .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
        .withArgs(minterAC.address, nullAddress, minterAC.address, 2, 1);
    });
    it('Wallet should receive fee when mint success', async () => {
      const walletAddress = this.omnuumWallet.address;

      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const prev_bal = await ethers.provider.getBalance(walletAddress);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await omnuumNFT1155.connect(minterAC).ticketMint(2, ticket, payload, {
        value: price.mul(2),
      });

      const mint_fee = price
        .mul(2)
        .mul(Constants.testValues.feeRate)
        .div(10 ** 5);

      const cur_bal = await ethers.provider.getBalance(walletAddress);

      expect(cur_bal).to.equal(prev_bal.add(mint_fee));
    });
    it('[Revert] Prevent CA call to mint', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
        mockNFT,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        mockNFT.ticketContractMint(omnuumNFT1155.address, 2, ticket, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT9);
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(2, ticket, payload, {
          value: price.mul(2).sub(price.div(2)),
        }),
      ).revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] Payload authenticate fail - (sender, signer)', async () => {
      const {
        accounts: [omnuumAC, minterAC, maliciousAC, anonymousAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const ticketPrice = ethers.utils.parseEther('0.4');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price: ticketPrice, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      // CASE1: valid payload, but malicious sender
      const invalidSenderPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.ticket,
        group_id,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(maliciousAC).ticketMint(2, ticket, invalidSenderPayload, {
          value: ticketPrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR4);

      // CASE2: invalid payload, signed by anonymous
      const anonymousSignedPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.ticket, // not mint topic payload
        nonce,
        anonymousAC, // anonymous signer
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(2, ticket, anonymousSignedPayload, {
          value: ticketPrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR1);
    });
    it('[Revert] Invalid ticket (user, price, groupId)', async () => {
      const {
        accounts: [omnuumAC, minterAC, maliciousAC, anotherNFTcontract],
        senderVerifier,
        ticketManager,
        omnuumNFT1155,
      } = this;

      const price = ethers.utils.parseEther('0.4');
      const quantity = 5;

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity },
        omnuumAC,
        ticketManager.address,
      );

      // CASE1: invalid signer
      const invalidSignedticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity },
        maliciousAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(quantity, invalidSignedticket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR1);

      // CASE2: invalid minter - normal payload, but use another address' ticket
      const invalidMinterPayload = await signPayload(
        maliciousAC.address,
        Constants.payloadTopic.ticket,
        group_id,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(maliciousAC).ticketMint(quantity, ticket, invalidMinterPayload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR6);

      // CASE3: invalid nft contract - ex) use A NFT ticket for B NFT
      const anotherContractTicket = await createTicket(
        { user: minterAC.address, nft: anotherNFTcontract.address, groupId: group_id, price, quantity },
        omnuumAC,
        ticketManager.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(quantity, anotherContractTicket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR5);
    });
    it('[Revert] Time expired ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, immediate_end_date)).wait();

      await delay(1000 * 3, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(2, ticket, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    });
    it('[Revert] Minter request more quantity than ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT1155,
        ticketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const ticketCount = 10;
      const initialTryCount = 12;
      const successTryCount = 7;
      const secondTryCount = 4;
      const successRemainingCount = 3;

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: ticketCount },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      // fail: try minting more than ticket amount
      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(initialTryCount, ticket, payload, {
          value: price.mul(initialTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // success: ticket count - 2
      await (
        await omnuumNFT1155.connect(minterAC).ticketMint(successTryCount, ticket, payload, {
          value: price.mul(successTryCount),
        })
      ).wait();

      // fail - try minting more than remaining ticket amount
      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(secondTryCount, ticket, payload, {
          value: price.mul(secondTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      await (
        await omnuumNFT1155.connect(minterAC).ticketMint(successRemainingCount, ticket, payload, {
          value: price.mul(secondTryCount),
        })
      ).wait();
    });
    it('[Revert] Minter request more quantity than total remaining quantity', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        ticketManager,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;

      const maxSupply = 10;
      const initialTryAmount = 12;
      const usingAmount = 8;
      const lastTryAmount = 3;

      // total max quantity 10
      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        maxSupply,
        caManagerAddress: omnuumCAManager.address,
      });

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 20 },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(initialTryAmount, ticket, payload, {
          value: price.mul(initialTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // use 8 of 10
      await (
        await omnuumNFT1155.connect(minterAC).ticketMint(usingAmount, ticket, payload, {
          value: price.mul(usingAmount),
        })
      ).wait();

      await expect(
        omnuumNFT1155.connect(minterAC).ticketMint(lastTryAmount, ticket, payload, {
          value: price.mul(lastTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  describe('[Method] setUri', () => {
    it('Should set uri and reveal', async () => {
      const { omnuumNFT1155 } = this;

      const uri = 'https://test.com';

      const tx = await omnuumNFT1155.setUri(uri);
      await tx.wait();

      await expect(tx).to.emit(omnuumNFT1155, Constants.events.NFT.Uri).withArgs(omnuumNFT1155.address, uri);
      await expect(await omnuumNFT1155.isRevealed()).to.be.true;
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_owner],
      } = this;

      const uri = 'https://test.com';

      await expect(omnuumNFT1155.connect(not_owner).setUri(uri)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] uri', () => {
    it('Should return cover uri when it is not revealed', async () => {
      const { omnuumNFT1155 } = this;

      const uri = await omnuumNFT1155.uri(1);

      expect(uri).to.equal(Constants.testValues.coverUri);
    });
    it('Should return base uri when it is revealed', async () => {
      const { omnuumNFT1155 } = this;

      const baseUri = 'https://baseUri.com';

      await (await omnuumNFT1155.setUri(baseUri)).wait();

      const uri = await omnuumNFT1155.uri(1);

      expect(uri).to.equal(baseUri);
    });
  });

  describe('[Method] transferBalance', () => {
    it('Should transfer the contract balance (to owner himself or somebody)', async () => {
      const {
        accounts: [omnuumAC, minterAC, prjOwnerAC, somebodyAC],
        senderVerifier,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
        ticketManager,
      } = this;

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      // Ticketing
      const ticketCount = 5;
      const price = ethers.utils.parseEther('1');
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: ticketCount },
        omnuumAC,
        ticketManager.address,
      );
      await (await ticketManager.connect(prjOwnerAC).setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();
      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);
      await (
        await omnuumNFT1155.connect(minterAC).ticketMint(ticketCount, ticket, payload, {
          value: price.mul(ticketCount),
        })
      ).wait();

      // Event emit check
      const testValue = ethers.utils.parseEther('0.123');
      await expect(omnuumNFT1155.connect(prjOwnerAC).transferBalance(testValue, prjOwnerAC.address))
        .to.emit(omnuumNFT1155, Constants.events.NFT.TransferBalance)
        .withArgs(testValue, prjOwnerAC.address);

      // Transfer Ether to Owner himself, then check the change of balances between OmnuumNFT1155 (decrement) and project Owner (increment)
      const transferEtherToOwnerSelf = ethers.utils.parseEther('1.492874');
      const transferBalanceTx = omnuumNFT1155.connect(prjOwnerAC).transferBalance(transferEtherToOwnerSelf, prjOwnerAC.address);
      await expect(() => transferBalanceTx).to.changeEtherBalance(omnuumNFT1155, transferEtherToOwnerSelf.mul('-1'));
      await expect(() => transferBalanceTx).to.changeEtherBalance(prjOwnerAC, transferEtherToOwnerSelf);

      // Transfer Ether to someone, then check the change of balances between OmnuumNFT1155 (decrement) and someone (increment)
      const transferEtherToSomebody = ethers.utils.parseEther('0.7389724');
      const transferBalanceSomebodyTx = omnuumNFT1155.connect(prjOwnerAC).transferBalance(transferEtherToSomebody, somebodyAC.address);
      await expect(() => transferBalanceSomebodyTx).to.changeEtherBalance(omnuumNFT1155, transferEtherToSomebody.mul('-1'));
      await expect(() => transferBalanceSomebodyTx).to.changeEtherBalance(somebodyAC, transferEtherToSomebody);
    });

    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_omnuumAC],
      } = this;

      await expect(
        omnuumNFT1155.connect(not_omnuumAC).transferBalance(ethers.utils.parseEther('0'), not_omnuumAC.address),
      ).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });

    it('[Revert] owner, but insufficient balance', async () => {
      const {
        accounts: [prjOwnerAC, somebodyAC],
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      await expect(
        omnuumNFT1155.connect(prjOwnerAC).transferBalance(ethers.utils.parseEther('999999'), somebodyAC.address),
      ).to.be.revertedWith(Constants.reasons.code.NE4);
    });
  });
  describe('[Method] receive', () => {
    it('can receive Ether', async () => {
      const {
        accounts: [prjOwnerAC, madFan],
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;
      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      const donation = ethers.utils.parseEther('10');

      const sendEtherTx = madFan.sendTransaction({
        to: omnuumNFT1155.address,
        value: donation,
      });

      await expect(() => sendEtherTx).to.changeEtherBalance(omnuumNFT1155, donation);

      await expect(sendEtherTx).to.emit(omnuumNFT1155, Constants.events.NFT.EtherReceived).withArgs(madFan.address);
    });
  });
});
