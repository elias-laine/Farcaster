// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuestSBT.sol";
import "../src/SocialQuestLottery.sol";

contract DeployScript is Script {
    function run() external {
        // Get deployment parameters from environment
        address signer = vm.envAddress("SIGNER_ADDRESS");
        uint256 deadline = vm.envUint("LOTTERY_DEADLINE");
        string memory baseURI = vm.envString("BASE_URI");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Lottery contract first
        SocialQuestLottery lottery = new SocialQuestLottery(deadline);
        console.log("Lottery deployed at:", address(lottery));

        // Deploy SBT contract
        SocialQuestSBT sbt = new SocialQuestSBT(
            signer,
            "Social Quest SBT",
            "SQSBT",
            baseURI
        );
        console.log("SBT deployed at:", address(sbt));

        // Link contracts
        sbt.setLotteryContract(address(lottery));
        lottery.setSBTContract(address(sbt));
        
        console.log("Contracts linked successfully");

        vm.stopBroadcast();
    }
}
