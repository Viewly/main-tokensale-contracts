const ViewlyMainSale = artifacts.require("ViewlyMainSale")
const {
  currentBlock, getBalance, mineBlocks,
  assertTxSuccess, assertTxFail, assertLastEvent
} = require('./test_helpers');


contract("ViewlyMainSale", (accounts) => {
  let sale;

  const owner = accounts[0];        // deployer
  const beneficiary = accounts[1];  // beneficiary

  const charlie = accounts[2];      // contributor
  const alex = accounts[3];         // contributor
  const sara = accounts[4];         // contributor

  beforeEach(async () => {
    sale = await ViewlyMainSale.new(beneficiary);
    await sale.setMinContributionAmount(web3.toWei(1, "ether"));
    await sale.initSale(currentBlock(web3), currentBlock(web3) + 10);
  });

  describe(".contribute", async() => {
    describe("when sale is open and amount >= min contribution", async() => {
      it("accepts funds", async () => {
        const initialBalance = (await web3.eth.getBalance(sale.address)).toNumber();
        const receipt = await sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") });
        const endingBalance = (await web3.eth.getBalance(sale.address)).toNumber();

        assert.equal(endingBalance - initialBalance, web3.toWei(1, "ether"));
      });

      it("logs contribute event", async () => {
        const receipt = await sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") });

        assertLastEvent(receipt, "LogContribute", { contributor: charlie, amount: web3.toWei(1, "ether") });
      });

      it("stores contribution amount", async () => {
        const total = web3.toWei(3, "ether");
        await sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") });
        await sale.sendTransaction({ from: charlie, value: web3.toWei(2, "ether") });

        assert.equal(await sale.contributions.call(charlie), total);
        assert.equal(await sale.totalContributedAmount.call(), total);
      });
    });

    describe("when requirements are not met", async() => {
      it("it fails when sale is open but amount is over max total amount", async() => {
        await sale.setMaxTotalAmount(web3.toWei(2, "ether"));
        await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(2.1, "ether") }));
      });

      it("it fails when sale is open but amount < min contribution", async() => {
        await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(0.999, "ether") }));
      });

      it("it fails when sale hasn't started yet", async() => {
        await sale.initSale(currentBlock(web3) + 10, currentBlock(web3) + 20);

        await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") }));
      });

      it("it fails when sale is already finished", async() => {
        await mineBlocks(web3, 10);

        await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") }));
      });
    });
  });

  describe(".refund", async() => {
    beforeEach(async () => {
      await sale.sendTransaction({ from: alex, value: web3.toWei(1, "ether") });
      await sale.sendTransaction({ from: charlie, value: web3.toWei(3, "ether") });
      await sale.sendTransaction({ from: charlie, value: web3.toWei(2, "ether") });
    });

    describe("when it succeeds", async() => {
      it("returns funds to contributor and resets contribution amount", async () => {
        const initialCharlieBalance = (await web3.eth.getBalance(charlie)).toNumber();
        const initialTotalAmount = (await sale.totalContributedAmount.call()).toNumber();
        const receipt = await sale.refund(charlie);
        const endingCharlieBalance = (await web3.eth.getBalance(charlie)).toNumber();
        const endingTotalAmount = (await sale.totalContributedAmount.call()).toNumber();

        assert.equal(endingCharlieBalance - initialCharlieBalance, web3.toWei(5, "ether"));
        assert.equal(endingTotalAmount - initialTotalAmount, web3.toWei(-5, "ether"));
        assert.equal(await sale.contributions.call(charlie), 0);
      });

      it("logs refund event and stores refunded amount", async () => {
        const receipt = await sale.refund(charlie, { from: owner });

        assertLastEvent(receipt, "LogRefund", { contributor: charlie, amount: web3.toWei(5, "ether") });
        assert.equal(await sale.refunds.call(charlie), web3.toWei(5, "ether"));
        assert.equal(await sale.totalRefundedAmount.call(), web3.toWei(5, "ether"));
      });
    });

    //it("fails when refund amount exeeds total balance", async () => {
      //await assertTxFail(sale.refund(charlie, { from: charlie }));
    //});

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.refund(charlie, { from: charlie }));
    });

    it("fails when called with inexistant contributor", async () => {
      await assertTxFail(sale.refund(sara));
    });
  });

  describe(".setMinContributionAmount", async() => {
    it("sets minimum contribution amount", async () => {
      const newAmount = web3.toWei(0.1, "ether");
      await sale.setMinContributionAmount(newAmount);

      assert.equal(await sale.minContributionAmount.call(), newAmount);
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.setMinContributionAmount(web3.toWei(1, "ether"), { from: alex }));
    });
  });

  describe(".setMaxTotalAmount", async() => {
    it("sets maximum total amount", async () => {
      const newAmount = web3.toWei(10, "ether");
      await sale.setMaxTotalAmount(newAmount);

      assert.equal(await sale.maxTotalAmount.call(), newAmount);
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.setMaxTotalAmount(100, { from: alex }));
    });
  });

  describe(".initSale", async() => {
    it("sets start and end blocks of the sale", async () => {
      await sale.initSale(100, 200);

      assert.equal((await sale.startBlock.call()).toNumber(), 100);
      assert.equal((await sale.endBlock.call()).toNumber(), 200);
    });

    it("fails if endBlock not greater than startBlock", async () => {
      await assertTxFail(sale.initSale(100, 100));
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.initSale(100, 200, { from: alex }));
    });
  });

  describe(".collectAmount", async() => {
    beforeEach(async () => {
      await sale.sendTransaction({ from: charlie, value: web3.toWei(3, "ether") });
    });

    it("sends given amount to beneficiary address and logs event", async () => {
      const amount = web3.toWei(2, "ether");
      const initialBalance = await getBalance(web3, beneficiary);
      const receipt = await sale.collectAmount(amount);
      const endingBalance = await getBalance(web3, beneficiary);

      assert.equal(endingBalance - initialBalance, amount);
      assertLastEvent(receipt, "LogCollectAmount", { amount: amount });
    });

    it("fails when collecting more than on balance", async () => {
      await assertTxFail(sale.collectAmount(web3.toWei(3.1, "ether")));
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.collectAmount(100, { from: alex }));
    });
  });

  describe(".addToWhitelist", async() => {
    it("adds contributors to whitelist", async () => {
      await sale.addToWhitelist([charlie, sara]);

      assert.equal((await sale.whitelist.call(charlie)), true)
      assert.equal((await sale.whitelist.call(sara)), true);
      assert.equal((await sale.whitelist.call(alex)), false);
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.addToWhitelist([charlie], { from: charlie }));
    });
  });

  describe(".removeFromWhitelist", async() => {
    it("removes contributors from whitelist", async () => {
      await sale.addToWhitelist([charlie, sara, alex]);
      await sale.removeFromWhitelist([charlie, sara]);

      assert.equal((await sale.whitelist.call(charlie)), false);
      assert.equal((await sale.whitelist.call(sara)), false);
      assert.equal((await sale.whitelist.call(alex)), true);
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.removeFromWhitelist([charlie], { from: charlie }));
    });
  });

  describe(".setWhitelistRequired", async() => {
    it("sets whitelist required flag", async () => {
      await sale.setWhitelistRequired(true);
      await sale.addToWhitelist([sara]);

      assert.equal(await sale.whitelistRequired.call(), true);
      await assertTxSuccess(sale.sendTransaction({ from: sara, value: web3.toWei(1, "ether") }));
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") }));
    });

    it("fails when not called by the owner", async () => {
      await assertTxFail(sale.setWhitelistRequired(true, { from: alex }));
    });
  });

  describe(".setOwner", async() => {
    it("doesnt allow changing of owner", async () => {
      await assertTxFail(sale.setOwner(sara, { from: owner }));
    });
  });

  describe(".setAuthority", async() => {
    it("doesnt allow changing of authority", async () => {
      await assertTxFail(sale.setAuthority(sara, { from: owner }));
    });
  });
});
