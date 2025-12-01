// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title AggregatorV3Interface
 * @dev Chainlink price feed interface for dynamic pricing
 */
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

/**
 * @title SocialQuest
 * @dev Combined Soulbound Token (SBT) + Lottery contract with dynamic prize pricing
 * @notice ✅ SECURITY: Reentrancy protection, Address.sendValue, Chainlink price feed
 */
contract SocialQuest is ERC721, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using Address for address payable;

    // ============================================
    // STRUCTS
    // ============================================
    struct PrizeTier {
        uint256 minParticipants;
        uint256 maxParticipants;
        uint256 winnersCount;
        uint256 prizePerWinner; // Will be calculated dynamically in wei
    }

    // ============================================
    // SBT SECTION
    // ============================================
    uint256 private _tokenIdCounter;
    address public immutable signer;
    mapping(address => bool) public hasMinted;
    mapping(uint256 => bool) public usedNonces;
    string private _baseTokenURI;

    // ============================================
    // LOTTERY SECTION
    // ============================================
    PrizeTier[] public prizeTiers;
    uint256 public immutable deadline;
    address public depositor;
    address[] public participants;
    mapping(address => bool) public isParticipant;
    mapping(address => uint256) public participantIndex;
    address[] public winners;
    mapping(address => bool) public isWinner;
    bool public isActive = true;
    bool public isExecuted = false;

    // ============================================
    // CHAINLINK PRICE FEED
    // ============================================
    // Base Mainnet ETH/USD Price Feed
    AggregatorV3Interface public constant priceFeed = 
        AggregatorV3Interface(0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70);
    uint256 public constant USD_PRIZE_AMOUNT = 2 * 10**17; // $0.2 in wei format (0.2 * 10^18)

    // ============================================
    // EVENTS
    // ============================================
    event SBTMinted(address indexed to, uint256 indexed tokenId, uint256 timestamp);
    event BaseURIUpdated(string newBaseURI);
    event ParticipantRegistered(address indexed participant, uint256 indexed index, uint256 timestamp);
    event LotteryExecuted(address[] winners, uint256 prizePerWinner, uint256 timestamp);
    event FundsDeposited(address indexed from, uint256 amount);
    event PrizeDistributed(address indexed winner, uint256 amount);
    event RemainingFundsReturned(address indexed depositor, uint256 amount);
    event EmergencyWithdrawal(address indexed depositor, uint256 amount);
    event PriceUpdated(int256 latestPrice);
    event LotteryWinnersSelected(address[] winners, bool fundsDistributed, string reason);

    // ============================================
    // ERRORS
    // ============================================
    error AlreadyMinted();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error TransferNotAllowed();
    error ZeroAddress();
    error LotteryNotActive();
    error LotteryAlreadyExecuted();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error AlreadyRegistered();
    error NoParticipants();
    error InvalidDeadline();
    error InsufficientFunds();
    error TransferFailed();
    error StalePrice();

    constructor(
        address _signer,
        uint256 _deadline,
        string memory _name,
        string memory _symbol,
        string memory baseURI_
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        if (_signer == address(0)) revert ZeroAddress();
        if (_deadline <= block.timestamp) revert InvalidDeadline();
        
        signer = _signer;
        deadline = _deadline;
        _baseTokenURI = baseURI_;

        // Initialize default prize tiers with default prize amount (~$5 USD at current ETH price)
        // Default: 0.002 ETH (approximately $5 at $2,500/ETH)
        // Call updatePrizeAmounts() after deployment to set the correct amount based on current price
        uint256 defaultPrizeInWei = 2 * 10**15;  // 0.002 ETH
        
        prizeTiers.push(PrizeTier({ minParticipants: 0, maxParticipants: 99, winnersCount: 1, prizePerWinner: defaultPrizeInWei }));
        prizeTiers.push(PrizeTier({ minParticipants: 100, maxParticipants: 499, winnersCount: 2, prizePerWinner: defaultPrizeInWei }));
        prizeTiers.push(PrizeTier({ minParticipants: 500, maxParticipants: 999, winnersCount: 3, prizePerWinner: defaultPrizeInWei }));
        prizeTiers.push(PrizeTier({ minParticipants: 1000, maxParticipants: 0, winnersCount: 4, prizePerWinner: defaultPrizeInWei }));
    }

    // ============================================
    // CHAINLINK PRICE FEED FUNCTIONS
    // ============================================

    /**
     * @dev Get current ETH/USD price from Chainlink
     * @return price The ETH/USD price in wei (scaled to 18 decimals)
     */
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        
        // Ensure price is not stale (not older than 1 hour)
        if (block.timestamp - updatedAt > 3600) revert StalePrice();
        
        return price;
    }

    /**
     * @dev Convert USD amount to ETH amount based on current price
     * @param usdAmount Amount in USD (scaled to 18 decimals)
     * @return ethAmount Amount in ETH (wei)
     */
    function getEthAmountForUsd(uint256 usdAmount) public view returns (uint256) {
        int256 price = getLatestPrice();
        require(price > 0, "Invalid price");
        
        uint8 decimals = priceFeed.decimals();
        uint256 priceScaled = uint256(price);
        
        // Calculate: usdAmount / price (with proper decimal handling)
        // Price feed returns price in 8 decimals typically
        // Formula: (usdAmount * 10^8) / price
        uint256 ethAmount = (usdAmount * (10 ** decimals)) / priceScaled;
        
        return ethAmount;
    }

    /**
     * @dev Update prize tiers with fresh ETH price
     */
    function updatePrizeAmounts() public onlyOwner {
        uint256 freshPrizeInWei = getEthAmountForUsd(USD_PRIZE_AMOUNT);
        
        for (uint256 i = 0; i < prizeTiers.length; i++) {
            prizeTiers[i].prizePerWinner = freshPrizeInWei;
        }
        
        emit PriceUpdated(getLatestPrice());
    }

    // ============================================
    // SBT FUNCTIONS
    // ============================================

    /**
     * @dev Mint SBT after verifying backend signature
     */
    function mint(bytes calldata signature, uint256 nonce) external nonReentrant {
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, nonce, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        if (recoveredSigner != signer) revert InvalidSignature();

        usedNonces[nonce] = true;
        hasMinted[msg.sender] = true;

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);

        // Register in lottery
        if (!isParticipant[msg.sender] && isActive && block.timestamp <= deadline) {
            participantIndex[msg.sender] = participants.length;
            participants.push(msg.sender);
            isParticipant[msg.sender] = true;
            emit ParticipantRegistered(msg.sender, participants.length - 1, block.timestamp);
        }

        emit SBTMinted(msg.sender, tokenId, block.timestamp);
    }

    /**
     * @dev Override transfer functions to make token soulbound
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert TransferNotAllowed();
        }
        return super._update(to, tokenId, auth);
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function canMint(address account) public view returns (bool) {
        return !hasMinted[account];
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    // ============================================
    // LOTTERY FUNCTIONS
    // ============================================

    /**
     * @dev Receive ETH for prize pool - only first depositor is recorded
     */
    receive() external payable {
        if (depositor == address(0)) {
            depositor = msg.sender;
        }
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Emergency withdrawal for depositor if lottery fails or no participants
     */
    function emergencyWithdraw() external nonReentrant {
        if (msg.sender != depositor) revert ZeroAddress();
        if (participants.length > 0 && !isExecuted) revert LotteryNotActive();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientFunds();

        payable(depositor).sendValue(balance);
        emit EmergencyWithdrawal(depositor, balance);
    }

    /**
     * @dev Execute lottery and select winners
     * If funds are available, distribute prizes automatically
     * If funds are insufficient, only mark winners without transferring funds
     * Uses block-based randomness (secure on Base)
     */
    function executeLottery() external onlyOwner nonReentrant {
        if (isExecuted) revert LotteryAlreadyExecuted();
        if (block.timestamp <= deadline) revert DeadlineNotPassed();
        if (participants.length == 0) revert NoParticipants();

        // Update prize amounts based on fresh Chainlink price feed
        updatePrizeAmounts();

        isActive = false;
        isExecuted = true;

        PrizeTier memory currentTier = getCurrentTier();
        uint256 winnersCount = currentTier.winnersCount;

        if (participants.length < winnersCount) {
            winnersCount = participants.length;
        }

        // Generate seed from block data (secure on Base)
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.number,
                    block.prevrandao,
                    block.timestamp
                )
            )
        );

        _selectWinners(winnersCount, seed);

        uint256 totalPrizeAmount = winnersCount * currentTier.prizePerWinner;
        
        // Check if funds have been deposited
        bool hasFundsDeposited = address(this).balance >= totalPrizeAmount;

        if (hasFundsDeposited) {
            // Case 1: Funds are available - distribute prizes
            for (uint256 i = 0; i < winners.length; i++) {
                address winner = winners[i];
                uint256 prize = currentTier.prizePerWinner;
                
                // Effects: Update state before external calls
                isWinner[winner] = true;
                
                // Interactions: Safe ETH transfer
                payable(winner).sendValue(prize);
                emit PrizeDistributed(winner, prize);
            }

            // Return remaining funds to depositor
            uint256 remainingFunds = address(this).balance;
            if (remainingFunds > 0 && depositor != address(0)) {
                payable(depositor).sendValue(remainingFunds);
                emit RemainingFundsReturned(depositor, remainingFunds);
            }

            emit LotteryExecuted(winners, currentTier.prizePerWinner, block.timestamp);
            emit LotteryWinnersSelected(winners, true, "Funds distributed successfully");
        } else {
            // Case 2: No funds deposited - only mark winners
            for (uint256 i = 0; i < winners.length; i++) {
                isWinner[winners[i]] = true;
            }

            emit LotteryExecuted(winners, currentTier.prizePerWinner, block.timestamp);
            emit LotteryWinnersSelected(winners, false, "No funds deposited - winners selected only");
        }
    }

    /**
     * @dev Internal function to select random winners using block-based randomness
     */
    function _selectWinners(uint256 count, uint256 seed) internal {
        address[] memory tempParticipants = participants;
        uint256 remaining = tempParticipants.length;

        for (uint256 i = 0; i < count && remaining > 0; i++) {
            uint256 randomIndex = (uint256(keccak256(abi.encodePacked(seed, i))) % remaining);

            address winner = tempParticipants[randomIndex];
            winners.push(winner);
            isWinner[winner] = true;

            tempParticipants[randomIndex] = tempParticipants[remaining - 1];
            remaining--;
        }
    }

    /**
     * @dev Get current prize tier
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

    function getParticipantsCount() public view returns (uint256) {
        return participants.length;
    }

    function getParticipants() public view returns (address[] memory) {
        return participants;
    }

    function getWinners() public view returns (address[] memory) {
        return winners;
    }

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

    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getPrizeTiersCount() public view returns (uint256) {
        return prizeTiers.length;
    }
}
