// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OMA.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title OMADeposit
 * @notice Handles USDC and OMA deposits on Base mainnet for the OMA AI Gateway.
 * Manages 50/50 token burn / treasury splits for OMA, and forwards 100% USDC to treasury.
 * Integrates EIP-2612 permit for single-transaction deposits.
 * @dev Uses 2-step ownership transfer to prevent accidental permanent loss of control.
 */
contract OMADeposit {
    address public owner;
    address public pendingOwner;
    address public treasury;
    OMA public immutable omaToken;
    IERC20 public immutable usdcToken;

    bool public paused;

    mapping(address => uint256) public userNonces;

    event UsdcDeposited(
        address indexed user,
        uint256 amount,
        uint256 indexed nonce,
        uint256 timestamp
    );

    event OmaDeposited(
        address indexed user,
        uint256 amount,
        uint256 burnAmount,
        uint256 treasuryAmount,
        uint256 indexed nonce,
        uint256 timestamp
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PausedStateUpdated(bool paused);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "OMADeposit: caller is not the owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "OMADeposit: contract is paused");
        _;
    }

    constructor(
        address _omaToken,
        address _usdcToken,
        address _treasury
    ) {
        require(_omaToken != address(0), "OMADeposit: zero address OMA token");
        require(_usdcToken != address(0), "OMADeposit: zero address USDC token");
        require(_treasury != address(0), "OMADeposit: zero address treasury");

        owner = msg.sender;
        omaToken = OMA(_omaToken);
        usdcToken = IERC20(_usdcToken);
        treasury = _treasury;
    }

    function depositUsdc(uint256 amount) external whenNotPaused {
        require(amount > 0, "OMADeposit: deposit amount must be greater than zero");

        uint256 nonce = userNonces[msg.sender]++;
        emit UsdcDeposited(msg.sender, amount, nonce, block.timestamp);

        require(
            usdcToken.transferFrom(msg.sender, treasury, amount),
            "OMADeposit: USDC transfer failed"
        );
    }

    function depositOma(uint256 amount) public whenNotPaused {
        require(amount > 0, "OMADeposit: deposit amount must be greater than zero");

        uint256 burnAmount = amount / 2;
        uint256 treasuryAmount = amount - burnAmount;

        uint256 nonce = userNonces[msg.sender]++;

        require(
            omaToken.transferFrom(msg.sender, address(this), amount),
            "OMADeposit: OMA transfer from sender failed"
        );

        omaToken.burn(burnAmount);

        require(
            omaToken.transfer(treasury, treasuryAmount),
            "OMADeposit: OMA transfer to treasury failed"
        );

        emit OmaDeposited(msg.sender, amount, burnAmount, treasuryAmount, nonce, block.timestamp);
    }

    function depositOmaWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        omaToken.permit(msg.sender, address(this), amount, deadline, v, r, s);
        depositOma(amount);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "OMADeposit: zero address treasury");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    /**
     * @notice Initiates 2-step ownership transfer. Sets the pending owner;
     * the new owner must call acceptOwnership() to complete the transfer.
     * This prevents accidentally transferring ownership to an inaccessible address.
     * @param _newOwner The address to transfer ownership to.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "OMADeposit: zero address owner");
        pendingOwner = _newOwner;
        emit OwnershipTransferStarted(owner, _newOwner);
    }

    /**
     * @notice Completes the 2-step ownership transfer. Only the pending owner
     * can call this function to accept ownership.
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "OMADeposit: caller is not the pending owner");
        emit OwnerUpdated(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateUpdated(_paused);
    }
}
