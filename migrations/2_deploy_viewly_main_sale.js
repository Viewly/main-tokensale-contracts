var ViewlyMainSale = artifacts.require("./ViewlyMainSale.sol");

module.exports = function(deployer, network) {
  let beneficiary = {
    "test":    "0xb81546A2E9e5C392B07e6f56cED4d43ffbaaAB56",
    "ganache": "0xb81546A2E9e5C392B07e6f56cED4d43ffbaaAB56",
    "kovan":   "0xb81546A2E9e5C392B07e6f56cED4d43ffbaaAB56",
    "mainnet": "0xf03f8d65bafa598611c3495124093c56e8f638f0",
  };
  console.log(`  Using beneficiary: ${beneficiary[network]}`);

  return deployer.deploy(ViewlyMainSale, beneficiary[network]);
};
