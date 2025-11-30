// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuest.sol";

contract DeployScript is Script {
    function run() external {
        // Get deployment parameters from environment
        address signer = vm.envAddress("SIGNER_ADDRESS");
        
        // LOTTERY_DEADLINE is optional - if not set, use 7 days from now
        uint256 deadline;
        try vm.envUint("LOTTERY_DEADLINE") returns (uint256 _deadline) {
            deadline = _deadline;
            console.log("Using LOTTERY_DEADLINE from env var:", deadline);
        } catch {
            // Default: 7 days from now
            deadline = block.timestamp + 7 days;
            console.log("LOTTERY_DEADLINE not set in env. Using default (7 days from now):", deadline);
        }
        
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
        console.log("Deadline (formatted):", deadline);
        console.log("Base URI:", baseURI);
        console.log("\nContract deployed successfully!");
        console.log("CONTRACT_ADDRESS:", address(socialQuest));

        vm.stopBroadcast();
    }
}
