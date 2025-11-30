// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuest.sol";

contract DeployScript is Script {
    function run() external {
        // Get deployment parameters from environment
        address signer = vm.envAddress("SIGNER_ADDRESS");
        uint256 deadline = vm.envUint("LOTTERY_DEADLINE");
        string memory baseURI = vm.envString("BASE_URI");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy combined SocialQuest contract
        SocialQuest socialQuest = new SocialQuest(
            signer,
            deadline,
            "Social Quest SBT",
            "SQSBT",
            baseURI
        );
        
        console.log("SocialQuest deployed at:", address(socialQuest));
        console.log("Signer:", signer);
        console.log("Deadline:", deadline);
        console.log("Base URI:", baseURI);
        console.log("\nContract deployed successfully!");
        console.log("CONTRACT_ADDRESS:", address(socialQuest));

        vm.stopBroadcast();
    }
}
