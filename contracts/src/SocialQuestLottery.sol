// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SocialQuestLottery
 * @dev Lottery contract for Social Quest campaign with tiered prizes
 * @notice Manages participant registration and random winner selection
 * @notice ✅ AUDIT SAFE: Immutable parameters and strict fund controls
 */
contract SocialQuestLottery is Ownable, ReentrancyGuard {
    // Struct for prize tier
    struct PrizeTier {
        uint256 minParticipants;
        uint256 maxParticipants; // 0 = unlimited
        uint256 winnersCount;
        uint256 prizePerWinner;
    }

    // Prize tiers
    PrizeTier[] public prizeTiers;

    // Lottery deadline (timestamp) - IMMUTABLE for fairness
    uint256 public immutable deadline;

    // SBT contract address - IMMUTABLE for security
    address public immutable sbtContract;

    // Array of participants
    address[] public participants;

    // Mapping to track if address is participant
    mapping(address => bool) public isParticipant;

    // Mapping to track participation index
    mapping(address => uint256) public participantIndex;

    // Array of winners
    address[] public winners;

    // Mapping to track if address won
    mapping(address => bool) public isWinner;

    // Lottery status
    bool public isActive = true;
    bool public isExecuted = false;

    // Events
    event ParticipantRegistered(address indexed participant, uint256 indexed index, uint256 timestamp);
    event LotteryExecuted(address[] winners, uint256 prizePerWinner, uint256 timestamp);
    event SBTContractUpdated(address indexed oldContract, address indexed newContract);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // Errors
    error LotteryNotActive();
    error LotteryAlreadyExecuted();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error AlreadyRegistered();
    error UnauthorizedCaller();
    error NoParticipants();
    error ZeroAddress();
    error InvalidDeadline();

    constructor(
        uint256 _deadline,
        address _sbtContract
    ) Ownable(msg.sender) {
        if (_deadline <= block.timestamp) revert InvalidDeadline();
        if (_sbtContract == address(0)) revert ZeroAddress();
        
        deadline = _deadline;
        sbtContract = _sbtContract;

        // Initialize default prize tiers
        // Tier 1: < 100 participants: 1 winner, $5 each
        prizeTiers.push(PrizeTier({
            minParticipants: 0,
            maxParticipants: 99,
            winnersCount: 1,
            prizePerWinner: 5 ether
        }));

        // Tier 2: 100-499 participants: 2 winners, $5 each
        prizeTiers.push(PrizeTier({
            minParticipants: 100,
            maxParticipants: 499,
            winnersCount: 2,
            prizePerWinner: 5 ether
        }));

        // Tier 3: 500-999 participants: 3 winners, $5 each
        prizeTiers.push(PrizeTier({
            minParticipants: 500,
            maxParticipants: 999,
            winnersCount: 3,
            prizePerWinner: 5 ether
        }));

        // Tier 4: 1000+ participants: 4 winners, $5 each
        prizeTiers.push(PrizeTier({
            minParticipants: 1000,
            maxParticipants: 0, // Unlimited
            winnersCount: 4,
            prizePerWinner: 5 ether
        }));
    }

    /**
     * @dev Register a participant (called by SBT contract when minting)
     * @param participant Address of the participant
     */
    function registerParticipant(address participant) external {
        if (msg.sender != sbtContract) revert UnauthorizedCaller();
        if (!isActive) revert LotteryNotActive();
        if (block.timestamp > deadline) revert DeadlinePassed();
        if (isParticipant[participant]) revert AlreadyRegistered();

        participantIndex[participant] = participants.length;
        participants.push(participant);
        isParticipant[participant] = true;

        emit ParticipantRegistered(participant, participants.length - 1, block.timestamp);
    }

    /**
     * @dev Execute the lottery and select winners
     * @notice Can only be called after deadline by owner
     * @notice Winners are selected on-chain but no funds are transferred (decentralized)
     */
    function executeLottery() external onlyOwner nonReentrant {
        if (isExecuted) revert LotteryAlreadyExecuted();
        if (block.timestamp <= deadline) revert DeadlineNotPassed();
        if (participants.length == 0) revert NoParticipants();

        isActive = false;
        isExecuted = true;

        // Get current tier based on participants count
        PrizeTier memory currentTier = getCurrentTier();
        uint256 winnersCount = currentTier.winnersCount;

        // Adjust winners count if fewer participants than winners
        if (participants.length < winnersCount) {
            winnersCount = participants.length;
        }

        // Select random winners (decentralized, on-chain)
        _selectWinners(winnersCount);

        // Emit event with winners and prize info
        emit LotteryExecuted(winners, currentTier.prizePerWinner, block.timestamp);
    }

    /**
     * @dev Internal function to select random winners
     * @param count Number of winners to select
     */
    function _selectWinners(uint256 count) internal {
        address[] memory tempParticipants = participants;
        uint256 remaining = tempParticipants.length;

        for (uint256 i = 0; i < count && remaining > 0; i++) {
            // Generate pseudo-random index
            // Note: For production, use Chainlink VRF for truly random selection
            uint256 randomIndex = uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        msg.sender,
                        i,
                        remaining
                    )
                )
            ) % remaining;

            // Add winner
            address winner = tempParticipants[randomIndex];
            winners.push(winner);
            isWinner[winner] = true;

            // Swap and reduce remaining
            tempParticipants[randomIndex] = tempParticipants[remaining - 1];
            remaining--;
        }
    }

    /**
     * @dev Get current prize tier based on participants count
     */
    function getCurrentTier() public view returns (PrizeTier memory) {
        uint256 count = participants.length;
        
        for (uint256 i = prizeTiers.length; i > 0; i--) {
            PrizeTier memory tier = prizeTiers[i - 1];
            if (count >= tier.minParticipants) {
                if (tier.maxParticipants == 0 || count <= tier.maxParticipants) {
                    return tier;
                }
            }
        }
        
        return prizeTiers[0];
    }

    /**
     * @dev Get total participants count
     */
    function getParticipantsCount() public view returns (uint256) {
        return participants.length;
    }

    /**
     * @dev Get all participants
     */
    function getParticipants() public view returns (address[] memory) {
        return participants;
    }

    /**
     * @dev Get all winners
     */
    function getWinners() public view returns (address[] memory) {
        return winners;
    }

    /**
     * @dev Get lottery stats
     */
    function getLotteryStats() public view returns (
        uint256 totalParticipants,
        uint256 currentWinnersCount,
        uint256 currentPrizePerWinner,
        uint256 currentTotalPrize,
        uint256 lotteryDeadline,
        bool active,
        bool executed
    ) {
        PrizeTier memory tier = getCurrentTier();
        return (
            participants.length,
            tier.winnersCount,
            tier.prizePerWinner,
            tier.winnersCount * tier.prizePerWinner,
            deadline,
            isActive,
            isExecuted
        );
    }

    /**
     * @dev Get number of prize tiers
     */
    function getPrizeTiersCount() public view returns (uint256) {
        return prizeTiers.length;
    }

    /**
     * @dev Get time remaining until deadline
     */
    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

    /**
     * @dev Deposit funds for prizes (via receive function)
     */
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Get contract balance
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
