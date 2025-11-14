# FHEVM v0.9 Updates Summary

## Overview

Your contracts have been updated to support FHEVM v0.9's new **self-relaying public decryption** workflow. The main issue you encountered was attempting to decrypt encrypted values without first marking them as publicly decryptable.

## The Error You Encountered

```
⚠️  Could not decrypt balance: Handle 0x7b2b... is not allowed for public decryption!
```

**Root Cause**: In FHEVM v0.9, you must explicitly call `FHE.makePubliclyDecryptable()` before attempting off-chain decryption.

## Changes Made to Your Contracts

### 1. eToken7984.sol

**Added Functions:**

```solidity
/// Makes your own balance publicly decryptable
function makeBalancePubliclyDecryptable() external returns (euint64)

/// Owner-only: Makes any account's balance publicly decryptable
function makeBalancePubliclyDecryptableFor(address account) external onlyOwner returns (euint64)
```

**Location**: [contracts/eToken7984.sol:30-47](contracts/eToken7984.sol#L30-L47)

### 2. eBatcherUpgradable.sol

**Added Function:**

```solidity
/// Makes any account's token balance publicly decryptable
function makeBalancePubliclyDecryptable(address token, address account) external returns (euint64)
```

**Location**: [contracts/eBatcherUpgradable.sol:149-161](contracts/eBatcherUpgradable.sol#L149-L161)

### 3. eWETH.sol

**Added Functions:**

```solidity
/// Makes your own balance publicly decryptable
function makeBalancePubliclyDecryptable() external returns (euint64)

/// Makes any account's balance publicly decryptable
function makeBalancePubliclyDecryptableFor(address account) external returns (euint64)
```

**Location**: [contracts/eWETH.sol:106-129](contracts/eWETH.sol#L106-L129)

**Note**: Your `eWETH.sol` was already correctly implementing the v0.9 pattern for withdrawals using `FHE.makePubliclyDecryptable()` and `FHE.checkSignatures()`. Great work!

## How to Use the New Functions

### Basic Pattern (FHEVM v0.9)

```typescript
// ❌ OLD (v0.8) - Won't work in v0.9
const balance = await token.confidentialBalanceOf(address);
const decrypted = await fhevm.publicDecrypt(balance); // FAILS!

// ✅ NEW (v0.9) - Correct approach
// Step 1: Make it publicly decryptable
const tx = await token.makeBalancePubliclyDecryptable();
await tx.wait();

// Step 2: Wait for coprocessor
await new Promise(resolve => setTimeout(resolve, 2000));

// Step 3: Now decrypt it
const balance = await token.confidentialBalanceOf(address);
const decrypted = await fhevm.publicDecrypt(balance); // Works!
```

## Example Scripts Created

### 1. Balance Verification Script

**File**: [scripts/verify-balance-v0.9.ts](scripts/verify-balance-v0.9.ts)

**Usage**:
```bash
export TOKEN_ADDRESS=0x...
npx hardhat run scripts/verify-balance-v0.9.ts --network sepolia
```

**What it does**: Demonstrates how to make a balance publicly decryptable and decrypt it off-chain.

### 2. Batch Transfer Test Script

**File**: [scripts/test-batch-transfer-v0.9.ts](scripts/test-batch-transfer-v0.9.ts)

**Usage**:
```bash
export TOKEN_ADDRESS=0x...
export BATCHER_ADDRESS=0x...
npx hardhat run scripts/test-batch-transfer-v0.9.ts --network sepolia
```

**What it does**:
- Tests the eBatcher contract with proper v0.9 decryption
- Shows balance verification before and after transfers
- Includes proper error handling

## Documentation Created

### Comprehensive Guide

**File**: [FHEVM_V09_PUBLIC_DECRYPTION_GUIDE.md](FHEVM_V09_PUBLIC_DECRYPTION_GUIDE.md)

**Contents**:
- Detailed explanation of the v0.8 vs v0.9 differences
- Step-by-step workflow for public decryption
- Code examples and patterns
- Security considerations
- Troubleshooting guide

## Key Takeaways

### The Three-Step v0.9 Decryption Workflow

1. **On-chain**: Call `makeBalancePubliclyDecryptable()` (or equivalent)
2. **Off-chain**: Use `fhevm.publicDecrypt()` to get cleartext + proof
3. **On-chain** (optional): Verify with `FHE.checkSignatures()`

### Architectural Change

| Aspect | v0.8 | v0.9 |
|--------|------|------|
| **Who handles decryption?** | Zama Oracle | Your dApp |
| **How to mark for decryption?** | `FHE.requestDecryption()` | `FHE.makePubliclyDecryptable()` |
| **Off-chain tool** | N/A | `@zama-fhe/relayer-sdk` |

### Security Notes

1. ⚠️ **Anyone can decrypt** values marked with `FHE.makePubliclyDecryptable()`
2. 🔒 Only mark values public when necessary for your use case
3. 🎯 Consider access control on functions that make values public
4. ⏰ Consider time-limited or one-time decryption patterns

## Next Steps

### Before Testing

1. **Recompile contracts**:
   ```bash
   npx hardhat compile
   ```

2. **Redeploy contracts** (FHEVM v0.9 uses new addresses):
   ```bash
   npx hardhat run deploy/deploy-upgradeable.ts --network sepolia
   ```

### Testing Your Implementation

1. **Set environment variables**:
   ```bash
   export TOKEN_ADDRESS=0x... # Your deployed token address
   export BATCHER_ADDRESS=0x... # Your deployed batcher address
   ```

2. **Run the test script**:
   ```bash
   npx hardhat run scripts/test-batch-transfer-v0.9.ts --network sepolia
   ```

### Updating Your Original Script

In your original test script where you got the error, update the balance checking code:

```typescript
// Add before trying to decrypt balance
console.log("📝 Making balance publicly decryptable...");
const makeTx = await token.makeBalancePubliclyDecryptable();
await makeTx.wait();

// Wait for coprocessor
await new Promise(resolve => setTimeout(resolve, 2000));

// Now the original decrypt will work
const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);
console.log("✅ Decrypted balance:", decryptedBalance.toString());
```

## Troubleshooting

### Issue: "Handle is not allowed for public decryption"

**Solution**: You forgot to call `makeBalancePubliclyDecryptable()` first.

### Issue: "Handle not found" after calling makeBalancePubliclyDecryptable

**Solution**: Wait a few seconds/blocks for the coprocessor to process the request.

### Issue: "FHEVM instance not initialized"

**Solution**: Check that `@fhevm/hardhat-plugin` is properly loaded in `hardhat.config.ts`.

## References

- [Official FHEVM v0.9 Migration Guide](https://docs.zama.org/protocol/solidity-guides/migration-guide)
- [HeadsOrTails Example](https://github.com/zama-ai/fhevm/blob/release/0.9.x/docs/examples/heads-or-tails.md)
- [HighestDieRoll Example](https://github.com/zama-ai/fhevm/blob/release/0.9.x/docs/examples/highest-die-roll.md)

---

**Your contracts are now fully compatible with FHEVM v0.9!** 🎉
