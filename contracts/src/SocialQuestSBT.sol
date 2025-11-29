// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SocialQuestSBT
 * @dev Soulbound Token (non-transferable) for Social Quest campaign
 * @notice Users can only mint after completing all social tasks, verified by backend signature
 */
contract SocialQuestSBT is ERC721, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Counter for token IDs
    uint256 private _tokenIdCounter;

    // Signer address for verification (backend)
    address public signer;

    // Lottery contract address
    address public lotteryContract;

    // Mapping to track if an address has already minted
    mapping(address => bool) public hasMinted;

    // Mapping to track used nonces (prevents replay attacks)
    mapping(uint256 => bool) public usedNonces;

    // Token URI for metadata
    string private _baseTokenURI;

    // Events
    event SBTMinted(address indexed to, uint256 indexed tokenId, uint256 timestamp);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event LotteryContractUpdated(address indexed oldContract, address indexed newContract);
    event BaseURIUpdated(string newBaseURI);

    // Errors
    error AlreadyMinted();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error TransferNotAllowed();
    error ZeroAddress();
    error LotteryNotSet();

    constructor(
        address _signer,
        string memory _name,
        string memory _symbol,
        string memory baseURI_
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        if (_signer == address(0)) revert ZeroAddress();
        signer = _signer;
        _baseTokenURI = baseURI_;
    }

    /**
     * @dev Mint SBT after verifying backend signature
     * @param signature Signature from backend verifying task completion
     * @param nonce Unique nonce to prevent replay attacks
     */
    function mint(bytes calldata signature, uint256 nonce) external nonReentrant {
        // Check if already minted
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        
        // Check if nonce is used
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, nonce, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        if (recoveredSigner != signer) revert InvalidSignature();

        // Mark nonce as used
        usedNonces[nonce] = true;

        // Mark address as minted
        hasMinted[msg.sender] = true;

        // Mint token
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);

        // Register in lottery contract if set
        if (lotteryContract != address(0)) {
            ISocialQuestLottery(lotteryContract).registerParticipant(msg.sender);
        }

        emit SBTMinted(msg.sender, tokenId, block.timestamp);
    }

    /**
     * @dev Override transfer functions to make token soulbound (non-transferable)
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from = zero address) but block transfers
        if (from != address(0) && to != address(0)) {
            revert TransferNotAllowed();
        }
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Set the signer address (only owner)
     * @param _newSigner New signer address
     */
    function setSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address oldSigner = signer;
        signer = _newSigner;
        emit SignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @dev Set the lottery contract address (only owner)
     * @param _lotteryContract New lottery contract address
     */
    function setLotteryContract(address _lotteryContract) external onlyOwner {
        address oldContract = lotteryContract;
        lotteryContract = _lotteryContract;
        emit LotteryContractUpdated(oldContract, _lotteryContract);
    }

    /**
     * @dev Set base URI for token metadata (only owner)
     * @param baseURI_ New base URI
     */
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    /**
     * @dev Get base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Get total supply of tokens
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Check if address can mint (hasn't minted yet)
     * @param account Address to check
     */
    function canMint(address account) public view returns (bool) {
        return !hasMinted[account];
    }
}

/**
 * @dev Interface for the lottery contract
 */
interface ISocialQuestLottery {
    function registerParticipant(address participant) external;
}
