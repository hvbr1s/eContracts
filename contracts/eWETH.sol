// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC7984} from "openzeppelin-confidential-contracts/contracts/token/ERC7984/ERC7984.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title eWETH - Encrypted Wrapped ETH
 * @notice A wrapped ETH implementation with encrypted balances using FHE (Fully Homomorphic Encryption)
 *
 * IMPORTANT CONSTRAINTS:
 * - This contract uses euint64 for encrypted balances, which can only store values up to 2^64 - 1 token units
 * - Token has 6 decimals (inherited from ERC7984), while ETH has 18 decimals
 * - Maximum deposit: ~18.44 million ETH (uint64 max with 6 decimals = 18,446,744,073,709 tokens = 18.44M ETH)
 * - Conversion: 1 ETH (10^18 wei) = 1 eWETH (10^6 token units)
 */
contract eWETH is ZamaEthereumConfig, ERC7984 {
    uint256 private constant DECIMALS_CONVERSION = 10 ** 12;

    error DepositTooSmall();
    error DepositExceedsMaximum();
    error InvalidWithdrawalRequest();
    error ETHTransferFailed();

    event Deposit(address indexed dest, uint256 amount);
    event Withdrawal(address indexed source, euint64 amount);
    event WithdrawalRequested(address indexed source, bytes32 indexed handle);

    struct WithdrawalRequest {
        address user;
        bool isPending;
    }

    mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) {}

    receive() external payable {
        deposit();
    }

    fallback() external payable {
        deposit();
    }

    /**
     * @notice Deposit ETH and receive encrypted wrapped ETH tokens
     * @dev Converts ETH (18 decimals) to eWETH (6 decimals) by dividing by 10^12
     * Maximum deposit is ~18.44 million ETH due to euint64 constraints
     */
    function deposit() public payable {
        // Convert from 18 decimals (wei) to 6 decimals (token units)
        uint256 tokenAmount = msg.value / DECIMALS_CONVERSION;
        if (tokenAmount == 0) revert DepositTooSmall();
        if (tokenAmount > type(uint64).max) revert DepositExceedsMaximum();

        euint64 eDepositedAmount = FHE.asEuint64(uint64(tokenAmount));
        _mint(msg.sender, eDepositedAmount);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH by burning encrypted wrapped ETH tokens
     * @param amount Encrypted amount to withdraw (must be uint64 compatible)
     * @param inputProof Proof for the encrypted input
     * @dev Initiates a withdrawal request by making the ciphertext publicly decryptable
     * The user must then call completeWithdrawal() with the decrypted value and proof
     */
    function withdraw(externalEuint64 amount, bytes calldata inputProof) external {
        euint64 eWithdrawnAmount = FHE.fromExternal(amount, inputProof);

        // Make the ciphertext publicly decryptable
        FHE.makePubliclyDecryptable(eWithdrawnAmount);

        // Store the handle for verification later
        bytes32 handle = FHE.toBytes32(eWithdrawnAmount);
        withdrawalRequests[handle] = WithdrawalRequest({user: msg.sender, isPending: true});

        _burn(msg.sender, eWithdrawnAmount);

        emit WithdrawalRequested(msg.sender, handle);
    }

    /**
     * @notice Complete withdrawal after off-chain decryption
     * @param handle The handle of the encrypted amount (from WithdrawalRequested event)
     * @param cleartexts The decrypted withdrawal amount in token units (obtained via publicDecrypt off-chain)
     * @param decryptionProof Cryptographic proof from KMS for verification
     * @dev This function verifies KMS signatures and completes the ETH transfer to the user
     * Converts token units (6 decimals) back to wei (18 decimals) before sending ETH
     * The user/relayer must first call publicDecrypt() off-chain to obtain cleartexts and proof
     */
    function completeWithdrawal(bytes32 handle, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        // Get the withdrawal request
        WithdrawalRequest memory request = withdrawalRequests[handle];
        if (!request.isPending) revert InvalidWithdrawalRequest();

        // Decode the decrypted amount (in token units with 6 decimals)
        uint64 withdrawnTokenAmount = abi.decode(cleartexts, (uint64));

        // Verify signatures from KMS
        discloseEncryptedAmount(euint64.wrap(handle), withdrawnTokenAmount, decryptionProof);

        // Convert from 6 decimals (token units) to 18 decimals (wei)
        uint256 withdrawnWeiAmount = uint256(withdrawnTokenAmount) * DECIMALS_CONVERSION;

        // Delete the request and transfer ETH
        delete withdrawalRequests[handle];

        (bool success, ) = request.user.call{value: withdrawnWeiAmount}("");
        if (!success) revert ETHTransferFailed();

        emit Withdrawal(request.user, FHE.asEuint64(withdrawnTokenAmount));
    }

    /**
     * @notice Makes the caller's balance publicly decryptable for verification purposes
     * @dev This allows anyone to decrypt the balance off-chain using the relayer SDK
     * Useful for debugging and balance verification in FHEVM v0.9
     * @return The encrypted balance handle that can now be publicly decrypted
     */
    function makeBalancePubliclyDecryptable() external returns (euint64) {
        euint64 balance = confidentialBalanceOf(msg.sender);
        FHE.makePubliclyDecryptable(balance);
        return balance;
    }
}
