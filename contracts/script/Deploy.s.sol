// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuest.sol";

contract DeployScript is Script {
    // Chainlink Price Feed Addresses
    // Base Mainnet ETH/USD: 0x71041dddad3287f3d7d07f0b6f1d4e1d493b0331
    // Base Sepolia ETH/USD: 0x4aDC67696bA383F43DD60A9e78F2C97Fdd8d63C8
    
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
        // Chainlink price feed is hardcoded to Base Mainnet ETH/USD: 0x71041dddad3287f3d7d07f0b6f1d4e1d493b0331
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
        console.log("Chainlink Price Feed: 0x71041dDDAD3287F3D7D07F0B6f1D4E1d493B0331");
        console.log("\n=== CONTRACT DEPLOYED SUCCESSFULLY ===");
        console.log("CONTRACT_ADDRESS:", address(socialQuest));
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Copy CONTRACT_ADDRESS from above");
        console.log("2. Update client/src/lib/config.ts with CONTRACT_ADDRESS");
        console.log("3. Call updatePrizeAmounts() on the contract to set exact $5 USD prices");
        console.log("   (This ensures prizes match current ETH/USD rate from Chainlink)");

        vm.stopBroadcast();
    }
}
