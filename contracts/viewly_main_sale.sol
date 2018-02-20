// The MIT License (MIT)
// Copyright (c) 2017 Viewly (https://view.ly)

pragma solidity ^0.4.18;

import "./dappsys/math.sol";
import "./dappsys/auth.sol";

/* Viewly main token sale contract, where contributors send ethers in order to
 * later receive VIEW tokens (outside of this contract).
 */
contract ViewlyMainSale is DSAuth, DSMath {

    // STATE

    uint public minContributionAmount = 5 ether; // initial min contribution amount
    uint public maxTotalAmount = 4300 ether;     // initial min contribution amount
    address public beneficiary;                  // address to collect contributed amount to
    uint public startBlock;                      // start block of sale
    uint public endBlock;                        // end block of sale

    uint public totalContributedAmount;          // stores all contributions
    uint public totalRefundedAmount;             // stores all refunds

    mapping(address => uint256) public contributions;
    mapping(address => uint256) public refunds;

    bool public whitelistRequired;
    mapping(address => bool) public whitelist;


    // EVENTS

    event LogContribute(address contributor, uint amount);
    event LogRefund(address contributor, uint amount);
    event LogCollectAmount(uint amount);


    // MODIFIERS

    modifier saleOpen() {
        require(block.number >= startBlock);
        require(block.number <= endBlock);
        _;
    }

    modifier requireWhitelist() {
        if (whitelistRequired) require(whitelist[msg.sender]);
        _;
    }


    // PUBLIC

    function ViewlyMainSale(address beneficiary_) public {
        beneficiary = beneficiary_;
    }

    function() public payable {
        contribute();
    }


    // AUTH-REQUIRED

    function refund(address contributor) public auth {
        uint amount = contributions[contributor];
        require(amount > 0);
        require(amount <= this.balance);

        contributions[contributor] = 0;
        refunds[contributor] += amount;
        totalRefundedAmount += amount;
        totalContributedAmount -= amount;
        contributor.transfer(amount);
        LogRefund(contributor, amount);
    }

    function setMinContributionAmount(uint minAmount) public auth {
        require(minAmount > 0);

        minContributionAmount = minAmount;
    }

    function setMaxTotalAmount(uint maxAmount) public auth {
        require(maxAmount > 0);

        maxTotalAmount = maxAmount;
    }

    function initSale(uint startBlock_, uint endBlock_) public auth {
        require(startBlock_ > 0);
        require(endBlock_ > startBlock_);

        startBlock = startBlock_;
        endBlock   = endBlock_;
    }

    function collectAmount(uint amount) public auth {
        require(this.balance >= amount);

        beneficiary.transfer(amount);
        LogCollectAmount(amount);
    }

    function addToWhitelist(address[] contributors) public auth {
        require(contributors.length != 0);

        for (uint i = 0; i < contributors.length; i++) {
          whitelist[contributors[i]] = true;
        }
    }

    function removeFromWhitelist(address[] contributors) public auth {
        require(contributors.length != 0);

        for (uint i = 0; i < contributors.length; i++) {
          whitelist[contributors[i]] = false;
        }
    }

    function setWhitelistRequired(bool setting) public auth {
        whitelistRequired = setting;
    }


    // PRIVATE

    function contribute() private saleOpen requireWhitelist {
        require(msg.value >= minContributionAmount);
        require(maxTotalAmount >= add(totalContributedAmount, msg.value));

        contributions[msg.sender] += msg.value;
        totalContributedAmount += msg.value;
        LogContribute(msg.sender, msg.value);
    }
}
