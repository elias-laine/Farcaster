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

        // Deploy Lottery contract first (SBT address will be set after SBT deployment)
        SocialQuestLottery lottery = new SocialQuestLottery(deadline, address(0));
        console.log("Lottery deployed at:", address(lottery));

        // Deploy SBT contract with lottery address
        SocialQuestSBT sbt = new SocialQuestSBT(
            signer,
            address(lottery),
            "Social Quest SBT",
            "SQSBT",
            baseURI
        );
        console.log("SBT deployed at:", address(sbt));

        console.log("Contracts deployed successfully!");
        console.log("Save these addresses:");
        console.log("SBT_CONTRACT_ADDRESS:", address(sbt));
        console.log("LOTTERY_CONTRACT_ADDRESS:", address(lottery));

        vm.stopBroadcast();
    }
}
