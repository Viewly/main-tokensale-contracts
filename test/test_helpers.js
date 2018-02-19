async function getBalance(web3, address) {
  return (await web3.eth.getBalance(address)).toNumber();
}

function currentBlock(web3) {
  return web3.eth.getBlock('latest').number;
}

function mineBlocks(web3, blocks) {
  if (blocks == 0)
    return Promise.resolve();
  else
    return mineOneBlock(web3).then(() => mineBlocks(web3, blocks -1));
}

function mineOneBlock(web3) {
  return new Promise((resolve, reject) => {
    web3.currentProvider
      .sendAsync({ jsonrpc: "2.0", method: "evm_mine" }, (err, result) => resolve());
  });
}

async function assertTxFail(promise) {
  try {
    await promise;
  } catch (error) {
    const invalidOpcode = error.message.search('invalid opcode') > -1;
    const revert = error.message.search('revert') > -1;
    const outOfGas = error.message.search('out of gas') > -1;

    assert(invalidOpcode || outOfGas || revert, `Expected throw, got ${error} instead`);
    return;
  }

  assert(false, "Expected throw wasn't received");
};

function assertLastEvent(receipt, eventName, assertions) {
  const event = receipt.logs[0];
  assert.equal(event.event, eventName);

  Object.keys(assertions).forEach((key) => {
    let assertionValue = assertions[key];
    assertionValue = Number.isInteger(assertionValue) ? Number(assertionValue) : assertionValue;
    assert.equal(event.args[key], assertionValue);
  });
};


module.exports = {
  getBalance,
  currentBlock,
  mineBlocks,
  assertTxFail,
  assertLastEvent,
}
