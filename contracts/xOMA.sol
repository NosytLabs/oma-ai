// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OMA.sol";

/**
 * @title xOMA Token (Staked Open Model Access)
 * @notice ERC-4626 compatible staking vault wrapping OMA.
 * Stakers deposit OMA, receive xOMA shares, and earn auto-compounding yield.
 * Features a strict 20-day unstaking cooldown for security and protocol stability.
 * @dev Uses minimum first-deposit threshold to prevent ERC-4626 inflation attack.
 */
contract xOMA {
    string public constant name = "Staked OMA";
    string public constant symbol = "xOMA";
    uint8 public constant decimals = 18;

    OMA public immutable asset;

    uint256 public totalAssets;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public constant COOLDOWN_PERIOD = 20 days;

    uint256 public constant MIN_FIRST_DEPOSIT = 0.01 ether;

    struct Cooldown {
        uint256 shares;
        uint256 releaseTime;
    }

    mapping(address => Cooldown) public cooldowns;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event CooldownInitiated(address indexed user, uint256 shares, uint256 releaseTime);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    constructor(address _asset) {
        require(_asset != address(0), "xOMA: zero address asset");
        asset = OMA(_asset);
    }

    function stakedBalanceOf(address user) external view returns (uint256) {
        uint256 shares = balanceOf[user];
        if (shares == 0) return 0;
        return convertToAssets(shares);
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        return (assets == 0 || supply == 0) ? assets : (assets * supply) / totalAssets;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return (shares == 0 || supply == 0) ? shares : (shares * totalAssets) / supply;
    }

    /**
     * @notice Stakes OMA tokens by depositing assets into the vault.
     * @dev First deposit requires minimum MIN_FIRST_DEPOSIT to prevent
     * ERC-4626 inflation/donation attack where an attacker can grief
     * subsequent depositors by minting 1 share then donating assets.
     * @param assets The amount of OMA to stake.
     * @param receiver The address that will receive the xOMA shares.
     * @return shares The amount of xOMA shares minted.
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "xOMA: deposit must be greater than zero");

        if (totalSupply == 0) {
            require(assets >= MIN_FIRST_DEPOSIT, "xOMA: minimum first deposit required to prevent inflation attack");
        }

        shares = convertToShares(assets);
        require(shares > 0, "xOMA: zero shares minted");

        totalAssets += assets;
        totalSupply += shares;
        balanceOf[receiver] += shares;

        emit Transfer(address(0), receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);

        require(asset.transferFrom(msg.sender, address(this), assets), "xOMA: asset transfer failed");
    }

    function initiateUnstake(uint256 shares) external {
        require(shares > 0, "xOMA: shares must be greater than zero");
        require(balanceOf[msg.sender] >= shares, "xOMA: insufficient shares for unstake");

        require(cooldowns[msg.sender].shares == 0, "xOMA: unstake already pending");

        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
        emit Transfer(msg.sender, address(0), shares);

        uint256 releaseTime = block.timestamp + COOLDOWN_PERIOD;
        cooldowns[msg.sender] = Cooldown({
            shares: shares,
            releaseTime: releaseTime
        });

        emit CooldownInitiated(msg.sender, shares, releaseTime);
    }

    function completeUnstake(address receiver) external returns (uint256 assets) {
        Cooldown memory userCooldown = cooldowns[msg.sender];
        require(userCooldown.shares > 0, "xOMA: no pending unstake");
        require(block.timestamp >= userCooldown.releaseTime, "xOMA: cooldown active");

        delete cooldowns[msg.sender];

        assets = (userCooldown.shares * totalAssets) / (totalSupply + userCooldown.shares);
        require(assets <= totalAssets, "xOMA: math underflow");

        totalAssets -= assets;

        emit Withdraw(msg.sender, receiver, msg.sender, assets, userCooldown.shares);

        require(asset.transfer(receiver, assets), "xOMA: asset transfer failed");
    }

    function cancelUnstake() external {
        Cooldown memory userCooldown = cooldowns[msg.sender];
        require(userCooldown.shares > 0, "xOMA: no pending unstake");

        delete cooldowns[msg.sender];

        balanceOf[msg.sender] += userCooldown.shares;
        totalSupply += userCooldown.shares;

        emit Transfer(address(0), msg.sender, userCooldown.shares);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "xOMA: insufficient allowance");
            _approve(from, msg.sender, allowed - value);
        }
        _transfer(from, to, value);
        return true;
    }

    function harvestRewards(uint256 assets) external {
        require(assets > 0, "xOMA: zero rewards");
        totalAssets += assets;
        require(asset.transferFrom(msg.sender, address(this), assets), "xOMA: rewards transfer failed");
    }

    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal {
        require(from != address(0), "xOMA: transfer from zero address");
        require(to != address(0), "xOMA: transfer to zero address");
        require(balanceOf[from] >= value, "xOMA: transfer amount exceeds balance");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _approve(
        address owner,
        address spender,
        uint256 value
    ) internal {
        require(owner != address(0), "xOMA: approve from zero address");
        require(spender != address(0), "xOMA: approve to zero address");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
