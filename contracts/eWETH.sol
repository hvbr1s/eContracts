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
 * - This contract uses euint64 for encrypted balances, which can only store values up to 2^64 - 1 wei
 * - Maximum deposit/balance: 18.44 ETH (18,446,744,073,709,551,615 wei)
 * - Decimals: 18 (standard ETH decimals), but capacity is limited by euint64
 * - Deposits exceeding uint64 max will revert
 */
contract eWETH is ZamaEthereumConfig, ERC7984 {
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
     * @dev Deposit amount is limited to uint64 max (~18.44 ETH) due to euint64 encryption constraints
     * Attempting to deposit more will revert to prevent overflow and fund loss
     */
    function deposit() public payable {
        require(msg.value <= type(uint64).max, "Deposit amount exceeds uint64 max");
        euint64 eDepositedAmount = FHE.asEuint64(uint64(msg.value));
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
    function withdraw(externalEuint64 amount, bytes memory inputProof) external {
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
     * @param cleartexts The decrypted withdrawal amount (obtained via publicDecrypt off-chain)
     * @param decryptionProof Cryptographic proof from KMS for verification
     * @dev This function verifies KMS signatures and completes the ETH transfer to the user
     * The user/relayer must first call publicDecrypt() off-chain to obtain cleartexts and proof
     */
    function completeWithdrawal(bytes32 handle, bytes memory cleartexts, bytes memory decryptionProof) external {
        // Get the withdrawal request
        WithdrawalRequest storage request = withdrawalRequests[handle];
        require(request.isPending, "Invalid or already processed request");

        // Verify signatures from KMS
        bytes32[] memory handlesList = new bytes32[](1);
        handlesList[0] = handle;
        FHE.checkSignatures(handlesList, cleartexts, decryptionProof);

        // Decode the decrypted amount
        uint64 withdrawnAmount = abi.decode(cleartexts, (uint64));

        (bool success, ) = request.user.call{value: withdrawnAmount}("");
        require(success, "ETH transfer failed");
        request.isPending = false;

        emit Withdrawal(request.user, FHE.asEuint64(withdrawnAmount));
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
