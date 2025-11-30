// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuest.sol";

contract DeployScript is Script {
    // Chainlink VRF Coordinator addresses
    address constant BASE_MAINNET_VRF_COORDINATOR = 0x5C210eF41CD1dBA2D1B6Cc2ab2CF7980f03edfB5;
    address constant BASE_SEPOLIA_VRF_COORDINATOR = 0x2f5d29e5339f9d2e6bc25C3a3F3C18b26CDDcD87;

    // Key hash for Base Mainnet and Sepolia (200 gwei)
    bytes32 constant KEY_HASH = 0xb8373f735c1d546f76e5b86a3556c05b347157bb1661d1d4d96a19e32ba9c35e;

    function run() external {
        // Get deployment parameters from environment
        address signer = vm.envAddress("SIGNER_ADDRESS");
        uint256 deadline = vm.envUint("LOTTERY_DEADLINE");
        string memory baseURI = vm.envString("BASE_URI");
        uint64 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Determine VRF Coordinator based on chain
        uint256 chainId = block.chainid;
        address vrfCoordinator = chainId == 84532 
            ? BASE_SEPOLIA_VRF_COORDINATOR 
            : BASE_MAINNET_VRF_COORDINATOR;
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy combined SocialQuest contract with Chainlink VRF
        SocialQuest socialQuest = new SocialQuest(
            signer,
            deadline,
            "Social Quest SBT",
            "SQSBT",
            baseURI,
            vrfCoordinator,
            subscriptionId,
            KEY_HASH
        );
        
        console.log("SocialQuest deployed at:", address(socialQuest));
        console.log("VRF Coordinator:", vrfCoordinator);
        console.log("Subscription ID:", subscriptionId);
        console.log("Key Hash:", vm.toString(KEY_HASH));
        console.log("\n✅ IMPORTANT: Add this contract address to your VRF subscription!");
        console.log("Go to: https://vrf.chain.link");
        console.log("Contract address:", address(socialQuest));

        console.log("\nContract deployed successfully!");
        console.log("CONTRACT_ADDRESS:", address(socialQuest));

        vm.stopBroadcast();
    }
}
