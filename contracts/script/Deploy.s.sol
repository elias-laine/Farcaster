// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SocialQuest.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

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

        // Read prize tiers from env
        uint256 tierCount = 0;
        try vm.envUint("TIER_COUNT") returns (uint256 _count) {
            tierCount = _count;
            console.log("TIER_COUNT:", tierCount);
        } catch {
            // default to 4 tiers if not provided
            tierCount = 4;
            console.log("TIER_COUNT not set, defaulting to 4");
        }

        uint256[] memory mins = new uint256[](tierCount);
        uint256[] memory maxs = new uint256[](tierCount);
        uint256[] memory winners = new uint256[](tierCount);
        uint256[] memory prizes = new uint256[](tierCount);

        for (uint256 i = 0; i < tierCount; i++) {
            string memory idx = Strings.toString(i);
            string memory minKey = string.concat("TIER_MIN_", idx);
            string memory maxKey = string.concat("TIER_MAX_", idx);
            string memory winKey = string.concat("TIER_WINNERS_", idx);
            string memory prizeKey = string.concat("TIER_PRIZE_", idx);

            uint256 vmin = 0;
            uint256 vmax = 0;
            uint256 vwin = 1;
            uint256 vprize = 5 ether;

            try vm.envUint(minKey) returns (uint256 _m) { vmin = _m; } catch {}
            try vm.envUint(maxKey) returns (uint256 _m2) { vmax = _m2; } catch {}
            try vm.envUint(winKey) returns (uint256 _w) { vwin = _w; } catch {}
            try vm.envUint(prizeKey) returns (uint256 _p) { vprize = _p; } catch {}

            mins[i] = vmin;
            maxs[i] = vmax;
            winners[i] = vwin;
            prizes[i] = vprize;
            console.log("Tier", i, "min", vmin, "max", vmax, "winners", vwin, "prize", vprize);
        }

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy combined SocialQuest contract with custom tiers
        SocialQuest socialQuest = new SocialQuest(
            signer,
            deadline,
            mins,
            maxs,
            winners,
            prizes,
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
        vm.stopBroadcast();
    }
}
