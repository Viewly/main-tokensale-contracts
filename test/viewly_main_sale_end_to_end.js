const ViewlyMainSale = artifacts.require("ViewlyMainSale")
const {
  currentBlock, getBalance, mineBlocks,
  assertTxSuccess, assertTxFail, assertLastEvent
} = require('./test_helpers');


contract("ViewlyMainSale End-to-end Tests", (accounts) => {
  let sale;

  const owner = accounts[0];        // deployer
  const beneficiary = accounts[1];  // beneficiary

  const charlie = accounts[2];      // contributor
  const alex = accounts[3];         // contributor
  const sara = accounts[4];         // contributor
  const bob =  accounts[5];         // contributor

  beforeEach(async () => {
    sale = await ViewlyMainSale.new(beneficiary);
    await sale.setMinContributionAmount(web3.toWei(1, "ether"));
    await sale.setMaxTotalAmount(web3.toWei(10));
    await sale.initSale(currentBlock(web3), currentBlock(web3) + 20);
  });

  describe("sale scenarios", async() => {
    it("#1: normal sale without whitelisting", async () => {
      // fails below min contribution
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(0.5, "ether") }));

      // sells out
      await assertTxSuccess(sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") }));
      await assertTxSuccess(sale.sendTransaction({ from: sara, value: web3.toWei(9, "ether") }));

      // fails after sale is filled
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(1, "ether") }));

      // balance is on the contract
      assert.equal(await getBalance(web3, sale.address), web3.toWei(10, "ether"));

      // collect the funds to beneficiary and check balance
      const initialBalance = await getBalance(web3, beneficiary);
      await sale.collectAmount(web3.toWei(10, "ether"));
      const finalBalance = await getBalance(web3, beneficiary);
      assert.equal(finalBalance - initialBalance, web3.toWei(10, "ether"));

      // contributions are still closed after collection
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(2, "ether") }));
    });

    it("#2: sale with whitelisting", async () => {
      await sale.setWhitelistRequired(true);
      await sale.addToWhitelist([sara, alex]);

      // whitelisted contributors can send funds
      await assertTxSuccess(sale.sendTransaction({ from: sara, value: web3.toWei(3, "ether") }));

      // non-whitelisted contributors get rejected
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(3, "ether") }));

      // we can whitelist on the-go and re-try
      await sale.addToWhitelist([charlie]);
      await assertTxSuccess(sale.sendTransaction({ from: charlie, value: web3.toWei(3, "ether") }));

      // we can also de-whitelist on the-go
      await sale.removeFromWhitelist([sara]);
      await assertTxFail(sale.sendTransaction({ from: sara, value: web3.toWei(4, "ether") }));

      // whitelisted alex can close the sale
      await sale.sendTransaction({ from: alex, value: web3.toWei(4, "ether") });

      assert.equal(await getBalance(web3, sale.address), web3.toWei(10, "ether"));
    });

    it("#3: in multiple stages, with extension", async () => {
      // stage 1: whitelisting, min 2 eth
      await sale.setMinContributionAmount(web3.toWei(2, "ether"));
      await sale.setWhitelistRequired(true);
      await sale.addToWhitelist([sara, alex]);

      // whitelisted contributors can send funds
      await assertTxSuccess(sale.sendTransaction({ from: sara, value: web3.toWei(2, "ether") }));
      // below min 2 eth tx fails
      await assertTxFail(sale.sendTransaction({ from: sara, value: web3.toWei(1, "ether") }));
      // non-whitelisted contributors get rejected
      await assertTxFail(sale.sendTransaction({ from: charlie, value: web3.toWei(2, "ether") }));

      // stage 2: whitelisting not required, min 0.2 eth
      await sale.setMinContributionAmount(web3.toWei(0.2, "ether"));
      await sale.setWhitelistRequired(false);

      // non-whitelisted contributors can send funds
      await assertTxSuccess(sale.sendTransaction({ from: charlie, value: web3.toWei(2, "ether") }));
      await assertTxSuccess(sale.sendTransaction({ from: bob, value: web3.toWei(3, "ether") }));
      // min contribution amount is lowered
      await assertTxSuccess(sale.sendTransaction({ from: alex, value: web3.toWei(0.8, "ether") }));
      await assertTxSuccess(sale.sendTransaction({ from: alex, value: web3.toWei(0.2, "ether") }));

      // fast-forward to end sale
      await mineBlocks(web3, 10);

      // contributions no longer work after sale ended
      await assertTxFail(sale.sendTransaction({ from: sara, value: web3.toWei(1, "ether") }));
      assert.equal(await getBalance(web3, sale.address), web3.toWei(8, "ether"));

      // we can resurrect the sale by extending it
      await sale.initSale(await sale.startBlock(), await sale.startBlock() + 100);
      await assertTxSuccess(sale.sendTransaction({ from: sara, value: web3.toWei(1, "ether") }));

      // ensure correct final balance
      assert.equal(await getBalance(web3, sale.address), web3.toWei(9, "ether"));
    });
  });
});
