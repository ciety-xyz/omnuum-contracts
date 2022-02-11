const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { map, delay } = require('fxjs');
const { addDays } = require('date-fns');
const Constants = require('../utils/constants.js');
require('chai').should();

const { createNftContractArgs, prepareDeploy, testDeploy, deployNFT } = require('./etc/mock.js');
const { signPayload, nullAddress, toSolDate, calcGasFeeInEther } = require('./etc/util.js');
const { events, reasons } = require('../utils/constants.js');

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
      await expect(tx).to.emit(omnuumNFT1155, events.NFT.Public).withArgs(true, price, end_date, 2000);
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
        omnuumTicketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, price, group_id, payload, {
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

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      const tx = await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, basePrice, nounce, payload, {
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
        omnuumTicketManager,
      } = this;

      const mint_amount = 2;
      const price = ethers.utils.parseEther('2');

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const prev_bal = await omnuumAC.getBalance();

      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, mint_amount, price, group_id, payload, {
          value: price.mul(mint_amount),
        })
      ).wait();

      const mint_fee = price
        .mul(2)
        .mul(Constants.testValues.mintFee)
        .div(10 ** 5);

      const cur_bal = await omnuumAC.getBalance();

      expect(cur_bal).to.equal(prev_bal.add(mint_fee));
    });
    it('[Revert] Cannot mint when NFT mint ended', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      // end mint
      await (await omnuumNFT1155.endMint()).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, price, group_id, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT7);
    });
    it('[Revert] Minter request more quantity than total remaining quantity', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumTicketManager,
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
      await (
        await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [20], [price], group_id, end_date)
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, initialTryAmount, price, group_id, payload, {
          value: price.mul(initialTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);

      // use 8 of 10
      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, usingAmount, price, group_id, payload, {
          value: price.mul(usingAmount),
        })
      ).wait();

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, lastTryAmount, price, group_id, payload, {
          value: price.mul(lastTryAmount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
    it('[Revert] Pay less money than required', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, price, group_id, payload, {
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

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, immediate_end_date, 2000)).wait();

      // wait 3 second for expire
      await delay(3000, 1);

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, basePrice, nounce, payload, {
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

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, openAmount + 2, basePrice, nounce, payload, {
          value: basePrice.mul(openAmount + 2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT3);
    });
    it('[Revert] Payload authenticate fail - (sender, nounce, topic)', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC, maliciousAC, anonymousAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const ticketPrice = ethers.utils.parseEther('0.4');

      // give Ticket to minter
      await (
        await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [ticketPrice], group_id, end_date)
      ).wait();

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      // CASE1: valid payload, but malicious sender
      await expect(
        omnuumNFT1155.connect(maliciousAC).mint(receiverAC.address, 2, basePrice, nounce, payload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.verifier.sender);

      // CASE2: valid payload, but signed for another purpose (topic)
      // required 'mint' but use 'topic'
      const ticketPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.ticket, // not mint topic payload
        nounce,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, basePrice, nounce, ticketPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.verifier.topic);

      // required 'ticket' but use 'mint'
      const publicPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.mint, // not mint topic payload
        group_id,
        omnuumAC,
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, ticketPrice, group_id, publicPayload, {
          value: ticketPrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.verifier.topic);

      // CASE3: invalid payload, signed by anonymous
      const anonymousSignedPayload = await signPayload(
        minterAC.address,
        Constants.payloadTopic.vrf, // not mint topic payload
        nounce,
        anonymousAC, // anonymous signer
        senderVerifier.address,
      );

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, basePrice, nounce, anonymousSignedPayload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.verifier.signer);

      // CASE4: expired payload, malicious nounce

      // increase nounce
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, basePrice, nounce, payload, {
          value: basePrice.mul(2),
        }),
      ).revertedWith(Constants.reasons.verifier.nounce);
    });
    it('[Revert] Cannot mint more quantity than max quantity per tx (public)', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const defaultArgs = createNftContractArgs(this);

      const basePrice = ethers.utils.parseEther('0.1');

      // make NFT public
      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, defaultArgs.maxMintPerAddress + 1, basePrice, nounce, payload, {
          value: basePrice.mul(defaultArgs.maxMintPerAddress + 1),
        }),
      ).revertedWith(Constants.reasons.code.MT2);
    });
    it('[Revert] Minter has no ticket and not public', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const price = ethers.utils.parseEther('0.2');

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, nounce, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, price, nounce, payload, {
          value: price.mul(2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT1);
    });
    it('[Revert] NFT is public but minter gives different price with public price', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
      } = this;

      const basePrice = ethers.utils.parseEther('0.1');
      const weirdPrice = ethers.utils.parseEther('0.01');

      await (await omnuumNFT1155.connect(omnuumAC).changePublicMint(true, basePrice, end_date, 2000)).wait(); // make NFT public

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.mint, nounce, omnuumAC, senderVerifier.address);

      // if request price doesn't match public sale price, try checking ticket which has same price with requested.
      // In this case, we didn't give ticket to minter, it should be reverted
      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, weirdPrice, nounce, payload, {
          value: weirdPrice.mul(2),
        }),
      ).to.be.revertedWith(reasons.verifier.topic);
    });
    it('[Revert] Minter request more quantity than ticket', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const ticketCount = 5;

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, ticketCount + 2, price, group_id, payload, {
          value: price.mul(ticketCount + 2),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT1);
    });
    it('[Revert] Minter request different price with ticket price', async () => {
      const {
        accounts: [omnuumAC, minterAC, receiverAC],
        senderVerifier,
        omnuumNFT1155,
        omnuumTicketManager,
      } = this;

      const price = ethers.utils.parseEther('0.2');
      const anotherPrice = price.mul(2);
      const ticketCount = 5;

      // give Ticket to minter
      await (await omnuumTicketManager.giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      await expect(
        omnuumNFT1155.connect(minterAC).mint(receiverAC.address, ticketCount, anotherPrice, group_id, payload, {
          value: anotherPrice.mul(ticketCount),
        }),
      ).to.be.revertedWith(Constants.reasons.code.MT1);
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
    it('[Revert] cannot mint when mint ended', async () => {
      const {
        accounts: [, receiverAC],
        omnuumNFT1155,
      } = this;

      // end mint
      await (await omnuumNFT1155.endMint()).wait();

      await expect(omnuumNFT1155.mintDirect(receiverAC.address, 2)).to.be.revertedWith(Constants.reasons.code.MT7);
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

  describe('[Method] endMint', () => {
    it('Should end mint', async () => {
      const { omnuumNFT1155 } = this;

      await (await omnuumNFT1155.endMint()).wait();

      const isEnd = await omnuumNFT1155.mintEnd();
      expect(isEnd).to.be.true;
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_ownerAC],
      } = this;

      await expect(omnuumNFT1155.connect(not_ownerAC).endMint()).to.be.revertedWith(Constants.reasons.common.onlyOwner);
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

  describe('[Method] setCoverUri', () => {
    it('Should set cover uri', async () => {
      const { omnuumNFT1155 } = this;

      const uri = 'https://test.com';

      const tx = await omnuumNFT1155.setCoverUri(uri);
      await tx.wait();

      await expect(tx).to.emit(omnuumNFT1155, Constants.events.NFT.UriChanged).withArgs(uri, 'cover');
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_owner],
      } = this;

      const uri = 'https://test.com';

      await expect(omnuumNFT1155.connect(not_owner).setCoverUri(uri)).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });

  describe('[Method] uri', () => {
    it('Should return cover uri when it is not revealed', async () => {
      const { omnuumNFT1155 } = this;

      const coverUri = 'https://test.com';

      const tx = await omnuumNFT1155.setCoverUri(coverUri);
      await tx.wait();

      const uri = await omnuumNFT1155.uri(1);

      expect(uri).to.equal(coverUri);
    });
    it('Should return cover uri when it is not revealed', async () => {
      const { omnuumNFT1155 } = this;

      const coverUri = 'https://coverUri.com';
      const baseUri = 'https://baseUri.com';

      await (await omnuumNFT1155.setCoverUri(coverUri)).wait();
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
        omnuumTicketManager,
        NFTbeacon,
        OmnuumNFT1155,
        omnuumCAManager,
      } = this;

      const omnuumNFT1155 = await deployNFT(NFTbeacon, OmnuumNFT1155, this, {
        caManagerAddress: omnuumCAManager.address,
        prjOwner: prjOwnerAC.address,
      });

      const price = ethers.utils.parseEther('0.2');

      // give Ticket to minter
      await (
        await omnuumTicketManager
          .connect(prjOwnerAC)
          .giveTicketBatch(omnuumNFT1155.address, [minterAC.address], [2], [price], group_id, end_date)
      ).wait();

      const payload = await signPayload(minterAC.address, Constants.payloadTopic.ticket, group_id, omnuumAC, senderVerifier.address);

      const prev_bal = await prjOwnerAC.getBalance();

      // send money
      await (
        await omnuumNFT1155.connect(minterAC).mint(receiverAC.address, 2, price, group_id, payload, {
          value: price.mul(2),
        })
      ).wait();

      const receipt = await (await omnuumNFT1155.connect(prjOwnerAC).withdraw()).wait();

      const gas_fee = calcGasFeeInEther(receipt);

      const cur_bal = await prjOwnerAC.getBalance();

      const mint_fee = price
        .mul(2)
        .mul(Constants.testValues.mintFee)
        .div(10 ** 5);

      expect(cur_bal).to.be.equal(prev_bal.add(price.mul(2).sub(mint_fee).sub(gas_fee)));
    });
    it('[Revert] only owner', async () => {
      const {
        omnuumNFT1155,
        accounts: [, not_omnuumAC],
      } = this;

      await expect(omnuumNFT1155.connect(not_omnuumAC).withdraw()).to.be.revertedWith(Constants.reasons.common.onlyOwner);
    });
  });
});
