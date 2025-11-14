# FHEVM v0.9 Public Decryption Guide

## Overview

FHEVM v0.9 introduces a major architectural change: **self-relaying public decryption**. The Zama Oracle has been removed, and dApps are now responsible for handling the decryption workflow themselves.

## The Problem You Encountered

The error you received:
```
⚠️  Could not decrypt balance: Handle 0x7b2b... is not allowed for public decryption!
```

This happens because in FHEVM v0.9, encrypted values **must be explicitly marked as publicly decryptable** before they can be decrypted off-chain.

## The Solution: Three-Step Workflow

### Step 1: Make the Encrypted Value Publicly Decryptable (On-Chain)

Before you can decrypt any encrypted value, you must call a function that marks it as publicly decryptable using `FHE.makePubliclyDecryptable()`.

**New functions added to your contracts:**

#### In `eToken7984.sol`:

```solidity
/// Makes your own balance publicly decryptable
function makeBalancePubliclyDecryptable() external returns (euint64)

/// Owner-only: Makes any account's balance publicly decryptable
function makeBalancePubliclyDecryptableFor(address account) external onlyOwner returns (euint64)
```

#### In `eBatcherUpgradable.sol`:

```solidity
/// Makes any account's token balance publicly decryptable
function makeBalancePubliclyDecryptable(address token, address account) external returns (euint64)
```

### Step 2: Decrypt Off-Chain Using the Relayer SDK

After marking the value as publicly decryptable, use the `@zama-fhe/relayer-sdk` or the FHEVM Hardhat plugin to decrypt:

```typescript
// Option 1: Using FHEVM Hardhat plugin (recommended)
const fhevm = (global as any).fhevm;
const decryptedValue = await fhevm.publicDecrypt(encryptedHandle);

// Option 2: Using relayer SDK directly
import { publicDecrypt } from "@zama-fhe/relayer-sdk";
const result = await publicDecrypt({
  handle: balanceHandle,
  chainId: chainId,
});
console.log("Decrypted value:", result.cleartext);
console.log("Proof:", result.proof);
```

### Step 3: (Optional) Verify On-Chain

If you need to prove the decrypted value on-chain, use `FHE.checkSignatures()`:

```solidity
function verifyBalance(
    address account,
    uint64 claimedBalance,
    bytes calldata proof
) external {
    euint64 encryptedBalance = confidentialBalanceOf(account);

    // Verify the claimed balance matches the encrypted balance
    bool isValid = FHE.checkSignatures(
        encryptedBalance,
        claimedBalance,
        proof
    );

    require(isValid, "Invalid balance proof");

    // Now you can use claimedBalance in your logic
}
```

## Updated Test/Script Flow

Here's how to update your test script:

```typescript
// OLD (FHEVM v0.8 - Won't work in v0.9)
const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
const balance = await fhevm.publicDecrypt(encryptedBalance); // ❌ FAILS!

// NEW (FHEVM v0.9 - Correct approach)
// Step 1: Make it publicly decryptable
const tx = await token.makeBalancePubliclyDecryptable();
await tx.wait();

// Step 2: Now decrypt it
const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
const balance = await fhevm.publicDecrypt(encryptedBalance); // ✅ Works!
```

## Example Script

Run the example script to verify balances:

```bash
# Set your token contract address
export TOKEN_ADDRESS=0x...

# Run the verification script
npx hardhat run scripts/verify-balance-v0.9.ts --network sepolia
```

## Key Changes from FHEVM v0.8

| Aspect | v0.8 | v0.9 |
|--------|------|------|
| **Decryption Handler** | Zama Oracle | dApp Client (you) |
| **Marking for Decryption** | Automatic via `FHE.requestDecryption()` | Manual via `FHE.makePubliclyDecryptable()` |
| **Off-Chain Tool** | N/A (Oracle handled it) | `@zama-fhe/relayer-sdk` |
| **Callback Pattern** | Oracle called your callback function | You submit the result yourself |

## Removed Functions (No Longer Available)

These functions from v0.8 have been removed:
- ❌ `FHE.requestDecryption()`
- ❌ `FHE.requestDecryptionWithoutSavingHandles()`
- ❌ `FHE.loadRequestedHandles()`

## Security Considerations

1. **Anyone can decrypt publicly decryptable values**: Once you call `FHE.makePubliclyDecryptable()`, anyone can decrypt that specific encrypted handle off-chain.

2. **Only mark values as public when necessary**: Don't expose sensitive balances unless required for your use case.

3. **Consider privacy implications**: For user balances, you might want to:
   - Only allow users to make their own balances public
   - Only make balances public when explicitly requested
   - Use time-limited or one-time decryption patterns

## Troubleshooting

### Error: "Handle is not allowed for public decryption"

**Solution**: You forgot to call `makeBalancePubliclyDecryptable()` (or equivalent) before trying to decrypt.

### Error: "Handle not found" or "Decryption failed"

**Solution**: Wait a few blocks after calling `makeBalancePubliclyDecryptable()` before attempting to decrypt. The coprocessor needs time to process the request.

### Error: "FHEVM instance not initialized"

**Solution**: Make sure `@fhevm/hardhat-plugin` is properly configured in your `hardhat.config.ts`.

## Further Reading

- [FHEVM v0.9 Migration Guide](https://docs.zama.org/protocol/solidity-guides/migration-guide)
- [HeadsOrTails Example](https://github.com/zama-ai/fhevm/blob/release/0.9.x/docs/examples/heads-or-tails.md)
- [HighestDieRoll Example](https://github.com/zama-ai/fhevm/blob/release/0.9.x/docs/examples/highest-die-roll.md)
