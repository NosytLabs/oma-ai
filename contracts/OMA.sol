// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OMA Token (Open Model Access)
 * @notice Permissionless utility token for the OMA AI Gateway.
 * Supports EIP-2612 Permit for gasless/single-transaction approvals.
 */
contract OMA {
    string public constant name = "Open Model Access";
    string public constant symbol = "OMA";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // EIP-2612 nonces
    mapping(address => uint256) public nonces;

    // EIP-712 domain separator
    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable DOMAIN_SEPARATOR;

    // Keccak256 hash of the permit function signature
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice Initializes the token and mints the initial 1 Billion OMA supply to the deployer.
     */
    constructor() {
        uint256 initialSupply = 1_000_000_000 * 10**uint256(decimals);
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /**
     * @notice Transfers tokens from the caller to a recipient.
     */
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @notice Approves a spender to transfer tokens on behalf of the owner.
     */
    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Transfers tokens from a sender to a recipient using allowance.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "OMA: insufficient allowance");
            _approve(from, msg.sender, allowed - value);
        }
        _transfer(from, to, value);
        return true;
    }

    /**
     * @notice Approves a spender to transfer tokens using an EIP-712 signature.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "OMA: signature expired");

        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonces[owner]++,
                deadline
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0) && signer == owner, "OMA: invalid signature");

        _approve(owner, spender, value);
    }

    /**
     * @notice Allows burning tokens from the sender's account.
     */
    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }

    /**
     * @notice Internal helper to transfer tokens.
     */
    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal {
        require(from != address(0), "OMA: transfer from the zero address");
        require(to != address(0), "OMA: transfer to the zero address");
        require(balanceOf[from] >= value, "OMA: transfer amount exceeds balance");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    /**
     * @notice Internal helper to approve allowance.
     */
    function _approve(
        address owner,
        address spender,
        uint256 value
    ) internal {
        require(owner != address(0), "OMA: approve from the zero address");
        require(spender != address(0), "OMA: approve to the zero address");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @notice Internal helper to burn tokens.
     */
    function _burn(address account, uint256 value) internal {
        require(account != address(0), "OMA: burn from the zero address");
        require(balanceOf[account] >= value, "OMA: burn amount exceeds balance");

        balanceOf[account] -= value;
        totalSupply -= value;
        emit Transfer(account, address(0), value);
    }
}
