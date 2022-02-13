const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { map, delay } = require('fxjs');
const { addDays } = require('date-fns');
const Constants = require('../utils/constants.js');
require('chai').should();

const { createNftContractArgs, prepareDeploy, testDeploy, deployNFT } = require('./etc/mock.js');
const { signPayload, nullAddress, toSolDate, calcGasFeeInEther, createTicket, createEmptyTicketForPublicMint } = require('./etc/util.js');

const nounce = 1;
const end_date = toSolDate(addDays(new Date(), 2));
const group_id = 0;

upgrades.silenceWarnings();

describe('OmnuumNFT', () => {
  before(async () => {
    await prepareDeploy.call(this);
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
            defaultArgs.uri,
            defaultArgs.caManagerAddress,
            defaultArgs.omnuumAddress,
            defaultArgs.maxMintPerAddress,
            defaultArgs.maxSupply,
            defaultArgs.coverUri,
            defaultArgs.prjOwner,
          ),
      ).to.be.revertedWith(Constants.reasons.common.initialize);
    });
  });

  describe('[Method] changePublicMint', () => {
    it('Change NFT status to public and set basePrice', async () => {
      const { omnuumNFT1155 } = this;

      const price = ethers.utils.parseEther('0.1');

      // make NFT public
      const tx = await omnuumNFT1155.changePublicMint(true, price, end_date, 2000);
      await expect(tx).to.emit(omnuumNFT1155, Constants.events.NFT.Public).withArgs(true, price, end_date, 2000);
    });

    it('[Revert] not owner', async () => {
      const { omnuumNFT1155, accounts } = this;

      const price = ethers.utils.parseEther('0.1');
      // make NFT public
      await expect(omnuumNFT1155.connect(accounts[1]).changePublicMint(true, price, end_date, 2000)).to.be.revertedWith(
        Constants.reasons.common.onlyOwner,
      );
    });
  });

  describe('[Method] mint', () => {
    it('Mint with ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticket, payload, {
        value: price.mul(2),
      });

      await map(
        (idx) =>
          expect(tx)
            .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
            .withArgs(minterAC.address, nullAddress, receiverAC.address, idx, 1),
        [1, 2],
      );
    });
    it('Mint without ticket when NFT is on public sale', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, priceWithEmptyTicket, payload, {
        value: basePrice.mul(2),
      });

      await map(
        (idx) =>
          expect(tx)
            .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
            .withArgs(minterAC.address, nullAddress, receiverAC.address, idx, 1),
        [1, 2],
      );
    });
    it('Omnuum should receive fee when mint success', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const prev_bal = await omnuumAC.getBalance();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticket, payload, {
        value: price.mul(2),
      });

      const mint_fee = price
        .mul(2)
        .mul(Constants.testValues.mintFee)
        .div(10 ** 5);

      const cur_bal = await omnuumAC.getBalance();

      expect(cur_bal).to.equal(prev_bal.add(mint_fee));
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticket, payload, {
          value: price.mul(2).sub(price.div(2)),
        }),
      ).revertedWith(Constants.reasons.code.MT5);
    });
    it('[Revert] Cannot mint as public after public mint schedule ended', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, immediate_end_date, 2000)).wait();

      // wait 3 second for expire
      await delay(3000, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, priceWithEmptyTicket, payload, {
          value: basePrice.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    }).timeout(5000);
    it('[Revert] Remaining public mint amount is not enough', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const openAmount = 10;
      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, openAmount)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, openAmount + 2, priceWithEmptyTicket, payload, {
          value: basePrice.mul(openAmount + 2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
    it('[Revert] Payload authenticate fail - (sender, nounce, topic)', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC, maliciousAC, anonymousAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const ticketPrice = ethers.utils.parseEther('0.4');

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price: ticketPrice, quantity: 2 },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      // CASE1: valid payload, but malicious sender
      await expect(
        omnuumNFT1155.connect(maliciousAC).mint(receiverAC.address, 2, priceWithEmptyTicket, payload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.senderVerifier.sender);

      // CASE2: valid payload, but signed for another purpose (topic)
      // required 'mint' but use 'ticket'
      const ticketPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.ticket, // not mint topic payload
        nounce,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, priceWithEmptyTicket, ticketPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.senderVerifier.topic);

      // required 'ticket' but use 'mint'
      const publicPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.mint, // not mint topic payload
        group_id,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticket, publicPayload, {
          value: ticketPrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.senderVerifier.topic);

      // CASE3: invalid payload, signed by anonymous
      const anonymousSignedPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.vrf, // not mint topic payload
        nounce,
        anonymousAC, // anonymous signer
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, priceWithEmptyTicket, anonymousSignedPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.senderVerifier.signer);

      // CASE4: expired payload, malicious nounce

      // increase nounce
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, priceWithEmptyTicket, payload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.senderVerifier.nounce);
    });
    it('[Revert] Cannot mint more quantity than max quantity per address (public)', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const defaultArgs = createNftContractArgs(this);

      const basePrice = ethers.utils.parseEther('0.1');

      const priceWithEmptyTicket = createEmptyTicketForPublicMint(basePrice);

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, defaultArgs.maxMintPerAddress + 1, priceWithEmptyTicket, payload, {
          value: basePrice.mul(defaultArgs.maxMintPerAddress + 1),
        }),
      ).revertedWith(Constants.reasons.code.MT2);
    });
    it('[Revert] Invalid ticket (user, price, groupId)', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC, maliciousAC, anotherNFTcontract],
        senderVerifier,
        ticketVerifier,
        omnuumNFT1155,
      } = this;

      const price = ethers.utils.parseEther('0.4');
      const quantity = 5;
      const cur_nounce = await omnuumNFT1155.nounce();

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity },
        omnuumAC,
        ticketVerifier.address,
      );

      // CASE1: invalid signer
      const invalidSignedticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity },
        maliciousAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, cur_nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, quantity, invalidSignedticket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.ticketVerifier.signer);

      // CASE2: invalid minter - normal payload, but use another address' ticket
      const invalidMinterPayload = await signPayload(
        maliciousAC.address,
        Constants.payloadTopic.ticket,
        cur_nounce,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(maliciousAC).mint(receiverAC.address, quantity, ticket, invalidMinterPayload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.ticketVerifier.minter);

      // CASE3: invalid nft contract - ex) use A NFT ticket for B NFT
      const anotherContractTicket = await createTicket(
        { user: minterAC.address, nft: anotherNFTcontract.address, groupId: group_id, price, quantity },
        omnuumAC,
        ticketVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, quantity, anotherContractTicket, payload, {
          value: price.mul(quantity),
        }),
      ).to.be.revertedWith(Constants.reasons.ticketVerifier.nft);
    });
    it('[Revert] Time expired ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const immediate_end_date = toSolDate(+new Date() + 1000);

      // give Ticket to minter
      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: 2 },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, immediate_end_date)).wait();

      await delay(1000 * 3, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticket, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT8);
    }).timeout(5000);
    it('[Revert] Minter request more quantity than ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        ticketVerifier,
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
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      // fail: try minting more than ticket amount
      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, initialTryCount, ticket, payload, {
          value: price.mul(initialTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // success: ticket count - 2
      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, successTryCount, ticket, payload, {
          value: price.mul(successTryCount),
        })
      ).wait();

      // fail - try minting more than remaining ticket amount
      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, secondTryCount, ticket, payload, {
          value: price.mul(secondTryCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, successRemainingCount, ticket, payload, {
          value: price.mul(secondTryCount),
        })
      ).wait();
    }).timeout(3000);
    it('[Revert] Minter request more quantity than total remaining quantity', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        ticketVerifier,
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
        ticketVerifier.address,
      );
      await (await ticketVerifier.setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, initialTryAmount, ticket, payload, {
          value: price.mul(initialTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // use 8 of 10
      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, usingAmount, ticket, payload, {
          value: price.mul(usingAmount),
        })
      ).wait();

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, lastTryAmount, ticket, payload, {
          value: price.mul(lastTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  describe('[Method] mintDirect', () => {
    it('Should direct mint without payload and ether', async () => {
      const {
        accounts: [omnuumAC, , receiverAC],
        omnuumNFT1155,
      } = this;

      const tx = await omnuumNFT1155.mintDirect(receiverAC.address, 2);

      await map(
        (idx) =>
          expect(tx)
            .to.emit(omnuumNFT1155, Constants.events.NFT.TransferSingle)
            .withArgs(omnuumAC.address, nullAddress, receiverAC.address, idx, 1),
        [1, 2],
      );
    });
    it('[Revert] only owner', async () => {
      const {
        accounts: [, not_omnuumAC],
        omnuumNFT1155,
      } = this;

      await expect(omnuumNFT1155.connect(not_omnuumAC).mintDirect(not_omnuumAC.address, 2)).to.be.revertedWith(Constants.reasons.code.OO2);
    });
    it('[Revert] Minter request more quantity than total remaining quantity', async () => {
      const {
        accounts: [, receiverAC],
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

      await expect(omnuumNFT1155.mintDirect(receiverAC.address, initialTryAmount)).to.be.revertedWith(Constants.reasons.code.MT3);

      // mint 8 of 10
      await (await omnuumNFT1155.mintDirect(receiverAC.address, usingAmount)).wait();

      await expect(omnuumNFT1155.mintDirect(receiverAC.address, lastTryAmount)).to.be.revertedWith(Constants.reasons.code.MT3);
    });
  });

  describe('[Method] setUri', () => {
    it('Should set uri and reveal', async () => {
      const { omnuumNFT1155 } = this;

      const uri = 'https://test.com';

      const tx = await omnuumNFT1155.setUri(uri);
      await tx.wait();

      await expect(tx).to.emit(omnuumNFT1155, Constants.events.NFT.UriChanged).withArgs(uri, 'base');
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
    it('Should return cover uri when it is not revealed', async () => {
      const { omnuumNFT1155 } = this;

      const baseUri = 'https://baseUri.com';

      await (await omnuumNFT1155.setUri(baseUri)).wait();

      const uri = await omnuumNFT1155.uri(1);

      expect(uri).to.equal(baseUri);
    });
  });

  describe('[Method] withdraw', () => {
    it('Should withdraw balance', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC, prjOwnerAC],
        senderVerifier,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
        ticketVerifier,
      } = this;

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      const ticketCount = 2;

      const price = ethers.utils.parseEther('0.2');

      const ticket = await createTicket(
        { user: minterAC.address, nft: omnuumNFT1155.address, groupId: group_id, price, quantity: ticketCount },
        omnuumAC,
        ticketVerifier.address,
      );
      await (await ticketVerifier.connect(prjOwnerAC).setEndDate(omnuumNFT1155.address, group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const prev_bal = await prjOwnerAC.getBalance();

      // send money
      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, ticketCount, ticket, payload, {
          value: price.mul(ticketCount),
        })
      ).wait();

      const receipt = await (await omnuumNFT1155.connect(prjOwnerAC).withdraw()).wait();

      const gas_fee = calcGasFeeInEther(receipt);

      const cur_bal = await prjOwnerAC.getBalance();

      const mint_fee = price
        .mul(ticketCount)
        .mul(Constants.testValues.mintFee)
        .div(10 ** 5);

      expect(cur_bal).to.be.equal(prev_bal.add(price.mul(ticketCount).sub(mint_fee).sub(gas_fee)));
    }).timeout(5000);
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_omnuumAC],
      } = this;

      await expect(omnuumNFT1155.connect(not_omnuumAC).withdraw()).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });
});
