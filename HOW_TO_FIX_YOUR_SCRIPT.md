# How to Fix Your Original Script

## Your Original Code (That Failed)

```typescript
// This is what you were trying to do:
📦 Encrypted balance handle: 0x7b2b2d4e32922347ae59b4a43a80c5156cbb130613ff0000000000aa36a70500
⚠️  Could not decrypt balance: Handle 0x7b2b... is not allowed for public decryption!
```

The problem was this line in your script:

```typescript
const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);  // ❌ FAILS!
```

## The Fix (3 Lines)

Add these 3 lines **BEFORE** trying to decrypt:

```typescript
// Add this BEFORE the decrypt attempt:
console.log("📝 Making balance publicly decryptable...");
const makeTx = await token.makeBalancePubliclyDecryptable();
await makeTx.wait();
console.log("✅ Balance marked as publicly decryptable");

// Wait for coprocessor to process (important!)
console.log("⏳ Waiting for coprocessor...");
await new Promise(resolve => setTimeout(resolve, 2000));

// NOW this will work:
const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
const balanceHandle = ethers.toBeHex(encryptedBalance, 32);
console.log("📦 Encrypted balance handle:", balanceHandle);

const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);  // ✅ Works!
console.log("✅ Decrypted token balance:", decryptedBalance.toString());
```

## Complete Fixed Example

Here's your complete balance checking code, fixed:

```typescript
// Step 1: Check wallet balance
console.log("\n📊 Checking wallet balance...");
console.log("⚡ Wallet ETH balance:",
  ethers.formatEther(await ethers.provider.getBalance(wallet.address)), "ETH");

try {
  // NEW: Make the balance publicly decryptable first
  console.log("📝 Making token balance publicly decryptable...");
  const makeTx = await token.makeBalancePubliclyDecryptable();
  await makeTx.wait();
  console.log("✅ Balance marked as publicly decryptable");

  // NEW: Wait for the coprocessor to process the request
  console.log("⏳ Waiting for coprocessor to process...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Now get and decrypt the balance (this will work now!)
  const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
  const balanceHandle = ethers.toBeHex(encryptedBalance, 32);
  console.log("📦 Encrypted balance handle:", balanceHandle);

  const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);
  console.log("✅ Decrypted token balance:", decryptedBalance.toString());

  // Check if we have enough for the transfer
  const totalNeeded = amountPerRecipient * BigInt(recipients.length);
  if (BigInt(decryptedBalance.toString()) < totalNeeded) {
    console.warn("⚠️  Warning: Insufficient token balance!");
    console.warn(`   Need: ${totalNeeded}, Have: ${decryptedBalance.toString()}`);
  }
} catch (error) {
  console.error("⚠️  Could not decrypt balance:", error.message);
  console.log("💡 Continuing with transfer anyway...");
}
```

## Alternative: Use the Batcher Contract

If you prefer, you can also use the batcher contract to make balances decryptable:

```typescript
// Instead of calling token.makeBalancePubliclyDecryptable()
const makeTx = await batcher.makeBalancePubliclyDecryptable(
  TOKEN_ADDRESS,
  wallet.address
);
await makeTx.wait();

// Then decrypt as usual
await new Promise(resolve => setTimeout(resolve, 2000));
const balance = await token.confidentialBalanceOf(wallet.address);
const decrypted = await fhevm.publicDecrypt(balance);
```

## Why the Wait?

The 2-second wait after calling `makePubliclyDecryptable()` is important:

```typescript
await new Promise(resolve => setTimeout(resolve, 2000));
```

**Why?** The FHEVM coprocessor needs time to process the decryption request. Without the wait, the handle might not be ready yet when you try to decrypt.

**How long?** Usually 2-3 seconds is enough. In production, you might want to:
- Wait for 1-2 blocks instead
- Poll until the decryption succeeds
- Use event listeners

## Production Pattern

For production code, here's a more robust approach:

```typescript
async function makeBalanceDecryptableAndWait(
  token: Contract,
  fhevm: FhevmInstance,
  address: string,
  maxRetries: number = 5
): Promise<bigint> {
  // Step 1: Make it decryptable
  const tx = await token.makeBalancePubliclyDecryptableFor(address);
  await tx.wait();

  // Step 2: Retry decryption with exponential backoff
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      const encryptedBalance = await token.confidentialBalanceOf(address);
      const decrypted = await fhevm.publicDecrypt(encryptedBalance);
      return BigInt(decrypted.toString());
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}...`);
    }
  }
  throw new Error("Failed to decrypt after max retries");
}

// Usage:
const balance = await makeBalanceDecryptableAndWait(token, fhevm, wallet.address);
console.log("Balance:", balance.toString());
```

## Summary

**What was wrong**: You tried to decrypt without calling `makePubliclyDecryptable()` first

**The fix**:
1. Call `token.makeBalancePubliclyDecryptable()`
2. Wait 2-3 seconds
3. Now decrypt with `fhevm.publicDecrypt()`

**Why it changed**: FHEVM v0.9 removed the Oracle and requires you to manage public decryption yourself

**Where to see working code**: Check [scripts/test-batch-transfer-v0.9.ts](scripts/test-batch-transfer-v0.9.ts) for a complete working example
