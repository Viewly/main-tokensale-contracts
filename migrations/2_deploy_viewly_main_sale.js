var ViewlyMainSale = artifacts.require("./ViewlyMainSale.sol");

module.exports = function(deployer, network) {
  let beneficiary = {
    "test":    "0xb81546A2E9e5C392B07e6f56cED4d43ffbaaAB56",
    "ganache": "0xb81546A2E9e5C392B07e6f56cED4d43ffbaaAB56",
    "kovan":   "0x00B17A6e5eDb9C4d9D01493A360f0B9a95EeDE3e",
    "mainnet": "0x80e36493e20926f8201e7C7dB2e20d24d7D2f7E5",
  };
  console.log(`  Using beneficiary: ${beneficiary[network]}`);

  return deployer.deploy(ViewlyMainSale, beneficiary[network]);
};
