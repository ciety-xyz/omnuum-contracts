const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { delay, go, range, mapC, each, hi } = require('fxjs');
const { addDays } = require('date-fns');
const Constants = require('../utils/constants.js');
require('chai').should();

const { prepareDeploy, testDeploy, deployNFT, prepareMockDeploy } = require('./etc/mock.js');
const { signPayload, nullAddress, toSolDate, createTicket } = require('./etc/util.js');

const nonce = 1;
const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

const publicMintTo = async ({
  omnuumNFT721Instance,
  omnuumMintManagerInstance,
  senderVerifierInstance,
  minterSigner,
  signatureSigner,
  groupId = 0,
  endDate = toSolDate(addDays(new Date(), 2)),
  publicMintSupply = 1000,
  maxMintPerAddress = 100,
  mintCount = 1,
  basePrice = ethers.utils.parseEther('0.1'),
}) => {
  // Set NFT Public Mint Schedule
  await (
    await omnuumMintManagerInstance.setPublicMintSchedule(
      omnuumNFT721Instance.address,
      groupId,
      endDate,
      basePrice,
      publicMintSupply,
      maxMintPerAddress,
    )
  ).wait();

  // Create Signature Hash
  const mintSignature = await signPayload(
    minterSigner.address,
    Constants.payloadTopic.mint,
    groupId,
    signatureSigner,
    senderVerifierInstance.address,
  );

  const mintPrice = basePrice.mul(mintCount);

  // Public Mint
  (
    await omnuumNFT721Instance.connect(minterSigner).publicMint(mintCount, groupId, mintSignature, {
      value: mintPrice,
    })
  ).wait();

  // Verify the minter actually get minted tokens for the amount of mint counts.
  expect(await omnuumNFT721Instance.balanceOf(minterSigner.address)).to.equal(mintCount);

  // Verify the owner of tokens are actually owned by minter
  const expectedTokenIds = range(1, 1 + mintCount);

  await go(
    range(1, 1 + mintCount),
    mapC(async (tokenId) => expect(await omnuumNFT721Instance.ownerOf(tokenId)).to.equal(minterSigner.address)),
  );
  return expectedTokenIds;
};

describe('OmnuumNFT', () => {
  before(async () => {
    await prepareDeploy.call(this);
    await prepareMockDeploy.call(this);
  });

  beforeEach(async () => {
    this.accounts = await ethers.getSigners();
    await testDeploy.call(this, this.accounts);
  });

  describe('[Method] Public Mint', () => {
    it('Public mint', async () => {
      const {
        accounts: [_, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      const tx = await omnuumNFT721.connect(minterAC).publicMint(2, group_id, payload, {
        value: basePrice.mul(2),
      });

      await expect(tx).to.emit(omnuumNFT721, Constants.events.NFT.Transfer).withArgs(nullAddress, minterAC.address, 1);

      await expect(tx).to.emit(omnuumNFT721, Constants.events.NFT.Transfer).withArgs(nullAddress, minterAC.address, 2);
    });
    it('Omnuum should receive fee when mint success', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        omnuumWallet,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.2');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 2;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);
      const mintTx = omnuumNFT721.connect(minterAC).publicMint(quantity, group_id, payload, {
        value: basePrice.mul(quantity),
      });
      const mint_fee = basePrice
        .mul(quantity)
        .mul(Constants.testValues.feeRate)
        .div(10 ** 5);

      await expect(() => mintTx).to.changeEtherBalance(omnuumWallet, mint_fee);
    });
    it('Omnuum should receive fee when mint success with special fee rate', async () => {
      const walletAddress = this.omnuumWallet.address;

      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        omnuumWallet,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.2');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 1;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      await omnuumMintManager.setSpecialFeeRate(omnuumNFT721.address, Constants.testValues.specialFeeRate);
      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);
      const mintTx = omnuumNFT721.connect(minterAC).publicMint(quantity, group_id, payload, {
        value: basePrice.mul(quantity),
      });
      const mint_fee = basePrice
        .mul(quantity)
        .mul(Constants.testValues.specialFeeRate)
        .div(10 ** 5);

      await expect(() => mintTx).to.changeEtherBalance(omnuumWallet, mint_fee);
    });
    it('[Revert] Prevent CA call to mint', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        mockNFT,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
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
        mockNFT.publicContractMint(omnuumNFT721.address, 2, group_id, payload, {
          value: basePrice.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT9);
    });
    it('[Revert] Payload authenticate fail - (sender, signer)', async () => {
      const {
        accounts: [, minterAC, maliciousAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      // CASE1: valid payload, but malicious sender
      await expect(
        omnuumNFT721.connect(maliciousAC).publicMint(2, group_id, payload, {
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
        omnuumNFT721.connect(maliciousAC).publicMint(2, group_id, invalidSignedPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR1);
    });
    it('[Revert] Cannot mint as public after public mint schedule ended', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          immediate_end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      // wait 3 second for expire
      await delay(3000, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).publicMint(2, group_id, payload, {
          value: basePrice.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;
      const quantity = 2;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).publicMint(quantity, group_id, payload, {
          value: basePrice.mul(quantity).div(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] Cannot mint more quantity than max quantity per address (public)', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 10;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).publicMint(max_min_per_address + 1, group_id, payload, {
          value: basePrice.mul(max_min_per_address + 1),
        }),
      ).revertedWith(Constants.reasons.code.MT2);
    });
    it('[Revert] Remaining public mint amount is not enough', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;
      const basePrice = ethers.utils.parseEther('0.1');

      const open_quantity = 2000;
      const max_min_per_address = 3000;

      // make NFT public
      await (
        await omnuumMintManager.setPublicMintSchedule(
          omnuumNFT721.address,
          group_id,
          end_date,
          basePrice,
          open_quantity,
          max_min_per_address,
        )
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).publicMint(open_quantity + 2, group_id, payload, {
          value: basePrice.mul(open_quantity + 2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  describe('[Method] ticketMint', () => {
    it('Mint with ticket', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      const tx = await omnuumNFT721.connect(minterAC).ticketMint(2, ticket, payload, {
        value: price.mul(2),
      });

      await expect(tx).to.emit(omnuumNFT721, Constants.events.NFT.Transfer).withArgs(nullAddress, minterAC.address, 1);

      await expect(tx).to.emit(omnuumNFT721, Constants.events.NFT.Transfer).withArgs(nullAddress, minterAC.address, 2);
    });
    it('Wallet should receive fee when mint success', async () => {
      const walletAddress = this.omnuumWallet.address;

      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const prev_bal = await ethers.provider.getBalance(walletAddress);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      await omnuumNFT721.connect(minterAC).ticketMint(2, ticket, payload, {
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
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        mockNFT,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      await expect(
        mockNFT.ticketContractMint(omnuumNFT721.address, 2, ticket, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT9);
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(2, ticket, payload, {
          value: price.mul(2).sub(price.div(2)),
        }),
      ).revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] Payload authenticate fail - (sender, signer)', async () => {
      const {
        accounts: [, minterAC, maliciousAC, anonymousAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const ticketPrice = ethers.utils.parseEther('0.4');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price: ticketPrice, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      // CASE1: valid payload, but malicious sender
      const invalidSenderPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.ticket,
        group_id,
        signatureSigner,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT721.connect(maliciousAC).ticketMint(2, ticket, invalidSenderPayload, {
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
        omnuumNFT721.connect(minterAC).ticketMint(2, ticket, anonymousSignedPayload, {
          value: ticketPrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.code.VR1);
    });
    it('[Revert] Invalid ticket (user, price, groupId)', async () => {
      const {
        accounts: [, minterAC, maliciousAC, anotherNFTcontract],
        senderVerifier,
        ticketManager,
        omnuumNFT721,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.4');
      const quantity = 5;

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity },
        signatureSigner,
        ticketManager.address,
      );

      // CASE1: invalid signer
      const invalidSignedticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity },
        maliciousAC,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(quantity, invalidSignedticket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR1);

      // CASE2: invalid minter - normal payload, but use another address' ticket
      const invalidMinterPayload = await signPayload(
        maliciousAC.address,
        Constants.payloadTopic.ticket,
        group_id,
        signatureSigner,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT721.connect(maliciousAC).ticketMint(quantity, ticket, invalidMinterPayload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR6);

      // CASE3: invalid nft contract - ex) use A NFT ticket for B NFT
      const anotherContractTicket = await createTicket(
        { user: minterAC.address, nft: anotherNFTcontract.address, groupId: group_id, price, quantity },
        signatureSigner,
        ticketManager.address,
      );

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(quantity, anotherContractTicket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.code.VR5);
    });
    it('[Revert] Time expired ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 2 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, immediate_end_date)).wait();

      await delay(1000 * 3, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(2, ticket, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    });
    it('[Revert] Minter request more quantity than ticket', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        omnuumNFT721,
        ticketManager,
        signatureSigner,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const ticketCount = 10;
      const initialTryCount = 12;
      const successTryCount = 7;
      const secondTryCount = 4;
      const successRemainingCount = 3;

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: ticketCount },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      // fail: try minting more than ticket amount
      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(initialTryCount, ticket, payload, {
          value: price.mul(initialTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // success: ticket count - 2
      await (
        await omnuumNFT721.connect(minterAC).ticketMint(successTryCount, ticket, payload, {
          value: price.mul(successTryCount),
        })
      ).wait();

      // fail - try minting more than remaining ticket amount
      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(secondTryCount, ticket, payload, {
          value: price.mul(secondTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      await (
        await omnuumNFT721.connect(minterAC).ticketMint(successRemainingCount, ticket, payload, {
          value: price.mul(secondTryCount),
        })
      ).wait();
    });
    it('[Revert] Minter request more quantity than total remaining quantity', async () => {
      const {
        accounts: [, minterAC],
        senderVerifier,
        ticketManager,
        signatureSigner,
      } = this;

      const maxSupply = 10;
      const initialTryAmount = 12;
      const usingAmount = 8;
      const lastTryAmount = 3;

      // total max quantity 10
      const omnuumNFT721 = await deployNFT(this, {
        maxSupply,
      });

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 20 },
        signatureSigner,
        ticketManager.address,
      );
      await (await ticketManager.setEndDate(omnuumNFT721.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(initialTryAmount, ticket, payload, {
          value: price.mul(initialTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // use 8 of 10
      await (
        await omnuumNFT721.connect(minterAC).ticketMint(usingAmount, ticket, payload, {
          value: price.mul(usingAmount),
        })
      ).wait();

      await expect(
        omnuumNFT721.connect(minterAC).ticketMint(lastTryAmount, ticket, payload, {
          value: price.mul(lastTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  const checkTokenURI = async (omnuumNFT721, iterQty, baseURI) => {
    await go(
      range(iterQty),
      mapC(async (idx) => {
        const tokenID = idx + 1;
        const expectedTokenURI = baseURI + tokenID;
        expect(await omnuumNFT721.tokenURI(tokenID)).to.equal(expectedTokenURI);
      }),
    );
  };

  describe('[Method] changeBaseURI', () => {
    it('Should change base URI', async () => {
      const {
        accounts: [, minterAC, prjOwnerAC],
        omnuumNFT721,
        omnuumMintManager,
      } = this;

      const { baseURI } = Constants.testValues;
      const airDropQty = 5;
      await omnuumMintManager.mintMultiple(omnuumNFT721.address, [minterAC.address], [airDropQty], {
        value: (await omnuumMintManager.minFee()).mul(airDropQty),
      });

      await checkTokenURI(omnuumNFT721, airDropQty, Constants.testValues.coverUri);

      const tx = await omnuumNFT721.changeBaseURI(baseURI);
      await tx.wait();

      await expect(tx).to.emit(omnuumNFT721, Constants.events.NFT.BaseURIChanged).withArgs(omnuumNFT721.address, baseURI);

      await checkTokenURI(omnuumNFT721, airDropQty, Constants.testValues.baseURI);
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT721,
        accounts: [, not_owner],
      } = this;

      const { baseURI } = Constants.testValues;

      await expect(omnuumNFT721.connect(not_owner).changeBaseURI(baseURI)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] transferBalance', () => {
    it('Should transfer the contract balance (to owner himself or somebody)', async () => {
      const {
        accounts: [, minterAC, prjOwnerAC, somebodyAC],
        senderVerifier,
        ticketManager,
        signatureSigner,
      } = this;

      const omnuumNFT721 = await deployNFT(this, {
        prjOwner: prjOwnerAC,
      });

      // Ticketing
      const ticketCount = 5;
      const price = ethers.utils.parseEther('1');

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT721.address, groupId: group_id, price, quantity: 20 },
        signatureSigner,
        ticketManager.address,
      );

      await (await ticketManager.connect(prjOwnerAC).setEndDate(omnuumNFT721.address, group_id, end_date)).wait();
      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, signatureSigner, senderVerifier.address);
      await (
        await omnuumNFT721.connect(minterAC).ticketMint(ticketCount, ticket, payload, {
          value: price.mul(ticketCount),
        })
      ).wait();

      // Event emit check
      const testValue = ethers.utils.parseEther('0.123');
      await expect(omnuumNFT721.connect(prjOwnerAC).transferBalance(testValue, prjOwnerAC.address))
        .to.emit(omnuumNFT721, Constants.events.NFT.BalanceTransferred)
        .withArgs(prjOwnerAC.address, testValue);

      // Transfer Ether to Owner himself, then check the change of balances between omnuumNFT721 (decrement) and project Owner (increment)
      const transferEtherToOwnerSelf = ethers.utils.parseEther('1.492874');
      const transferBalanceTx = omnuumNFT721.connect(prjOwnerAC).transferBalance(transferEtherToOwnerSelf, prjOwnerAC.address);
      await expect(() => transferBalanceTx).to.changeEtherBalance(omnuumNFT721, transferEtherToOwnerSelf.mul('-1'));
      await expect(() => transferBalanceTx).to.changeEtherBalance(prjOwnerAC, transferEtherToOwnerSelf);

      // Transfer Ether to someone, then check the change of balances between omnuumNFT721 (decrement) and someone (increment)
      const transferEtherToSomebody = ethers.utils.parseEther('0.7389724');
      const transferBalanceSomebodyTx = omnuumNFT721.connect(prjOwnerAC).transferBalance(transferEtherToSomebody, somebodyAC.address);
      await expect(() => transferBalanceSomebodyTx).to.changeEtherBalance(omnuumNFT721, transferEtherToSomebody.mul('-1'));
      await expect(() => transferBalanceSomebodyTx).to.changeEtherBalance(somebodyAC, transferEtherToSomebody);
    });

    it('[Revert] only owner', async () => {
      const {
        omnuumNFT721,
        accounts: [, not_omnuumAC],
      } = this;

      await expect(
        omnuumNFT721.connect(not_omnuumAC).transferBalance(ethers.utils.parseEther('0'), not_omnuumAC.address),
      ).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });

    it('[Revert] owner, but insufficient balance', async () => {
      const {
        accounts: [prjOwnerAC, somebodyAC],
      } = this;

      const omnuumNFT721 = await deployNFT(this, {
        prjOwner: prjOwnerAC,
      });

      await expect(
        omnuumNFT721.connect(prjOwnerAC).transferBalance(ethers.utils.parseEther('999999'), somebodyAC.address),
      ).to.be.revertedWith(Constants.reasons.code.NE4);
    });
  });
  describe('[Method] receive', () => {
    it('can receive Ether', async () => {
      const {
        accounts: [prjOwnerAC, madFan],
      } = this;
      const omnuumNFT721 = await deployNFT(this, {
        prjOwner: prjOwnerAC,
      });

      const donation = ethers.utils.parseEther('10');

      const sendEtherTx = madFan.sendTransaction({
        to: omnuumNFT721.address,
        value: donation,
      });

      await expect(() => sendEtherTx).to.changeEtherBalance(omnuumNFT721, donation);

      await expect(sendEtherTx).to.emit(omnuumNFT721, Constants.events.NFT.EtherReceived).withArgs(madFan.address, donation);
    });
  });
  describe('[Method] setRevealed', () => {
    it('can set revealed', async () => {
      const {
        accounts: [prjOwnerAC],
      } = this;
      const omnuumNFT721 = await deployNFT(this, {
        prjOwner: prjOwnerAC,
      });

      expect(await omnuumNFT721.isRevealed()).to.false;
      expect(await omnuumNFT721.baseURI()).to.equal(Constants.testValues.coverUri);

      const revealURI = Constants.testValues.baseURI;
      await expect(omnuumNFT721.setRevealed(revealURI)).to.emit(omnuumNFT721, Constants.events.NFT.Revealed).withArgs(omnuumNFT721.address);

      expect(await omnuumNFT721.baseURI()).to.equal(revealURI);
      expect(await omnuumNFT721.isRevealed()).to.true;
    });
  });

  describe('[Method] burn', () => {
    it('can burn', async () => {
      const {
        accounts: [_, minterSigner],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;
      const mintedTokenIds = await publicMintTo({
        omnuumNFT721Instance: omnuumNFT721,
        omnuumMintManagerInstance: omnuumMintManager,
        senderVerifierInstance: senderVerifier,
        minterSigner,
        signatureSigner,
        mintCount: 10,
      });

      // token burning
      await go(
        mintedTokenIds,
        mapC(async (tokenId) => {
          // Before burn
          expect(await omnuumNFT721.connect(minterSigner).ownerOf(tokenId)).to.equal(minterSigner.address);

          // Burn
          await omnuumNFT721.connect(minterSigner).burn(tokenId);

          // After burn
          await expect(omnuumNFT721.connect(minterSigner).ownerOf(tokenId)).to.be.revertedWith(Constants.reasons.common.notExistTokenQuery);
        }),
      );
    });
  });

  describe('[Revert] burn', () => {
    it('if not token owner', async () => {
      const {
        accounts: [_, minterSigner, madBurnerSigner],
        senderVerifier,
        omnuumNFT721,
        omnuumMintManager,
        signatureSigner,
      } = this;
      const mintedTokenIds = await publicMintTo({
        omnuumNFT721Instance: omnuumNFT721,
        omnuumMintManagerInstance: omnuumMintManager,
        senderVerifierInstance: senderVerifier,
        minterSigner,
        signatureSigner,
        mintCount: 10,
      });

      // token burning
      await go(
        [...mintedTokenIds],
        mapC(async (tokenId) => {
          // Before burn
          const txOwned = omnuumNFT721.connect(minterSigner).ownerOf(tokenId);
          expect(await txOwned).to.equal(minterSigner.address);

          // After burn
          const txBurn = omnuumNFT721.connect(madBurnerSigner).burn(tokenId);
          await expect(txBurn).to.be.revertedWith(Constants.reasons.common.notTokenOwnerOrApproved);
        }),
      );
    });
  });
});
