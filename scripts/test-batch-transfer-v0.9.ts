/**
 * FHEVM v0.9 Batch Transfer Test Script
 *
 * This script tests the eBatcher contract with proper FHEVM v0.9 public decryption workflow
 */

import { ethers } from "hardhat";
import type { FhevmInstance } from "@fhevm/hardhat-plugin";

async function main() {
  console.log("\n🚀 Starting FHE batch transfer test (FHEVM v0.9)...\n");

  const [wallet] = await ethers.getSigners();
  console.log("👤 Wallet address:", wallet.address);

  // Configuration - update these with your deployed contract addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
  const BATCHER_ADDRESS = process.env.BATCHER_ADDRESS || "";

  if (!TOKEN_ADDRESS || !BATCHER_ADDRESS) {
    throw new Error("❌ Please set TOKEN_ADDRESS and BATCHER_ADDRESS environment variables");
  }

  console.log("🪙 Token address:", TOKEN_ADDRESS);
  console.log("📦 Batcher address:", BATCHER_ADDRESS);

  // Get contracts
  const token = await ethers.getContractAt("eToken7984", TOKEN_ADDRESS);
  const batcher = await ethers.getContractAt("eBatcher7984Upgradeable", BATCHER_ADDRESS);

  // Get FHEVM instance
  const fhevm = (global as any).fhevm as FhevmInstance;
  if (!fhevm) {
    throw new Error("❌ FHEVM instance not initialized. Check your hardhat config.");
  }
  console.log("✅ FHE instance initialized via Hardhat plugin");

  // Test configuration
  const recipients = [
    process.env.RECIPIENT_1 || "0xF659feEE62120Ce669A5C45Eb6616319D552dD93",
    process.env.RECIPIENT_2 || "0xED8315fA2Ec4Dd0dA9870Bf8CD57eBf256A90772",
  ];
  const amountPerRecipient = 1000n;

  console.log("📋 Recipients:", recipients);
  console.log("💰 Amount per recipient:", amountPerRecipient.toString());

  // Step 1: Check initial balance (FHEVM v0.9 way)
  console.log("\n📊 Step 1: Checking wallet balance...");
  console.log("⚡ Wallet ETH balance:", ethers.formatEther(await ethers.provider.getBalance(wallet.address)), "ETH");

  try {
    // First, make the balance publicly decryptable
    console.log("📝 Making balance publicly decryptable...");
    const makeTx = await token.makeBalancePubliclyDecryptable();
    await makeTx.wait();
    console.log("✅ Balance marked as publicly decryptable");

    // Wait a moment for the coprocessor to process
    console.log("⏳ Waiting for coprocessor to process...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Now decrypt it
    const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
    const balanceHandle = ethers.toBeHex(encryptedBalance, 32);
    console.log("📦 Encrypted balance handle:", balanceHandle);

    const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);
    console.log("✅ Decrypted token balance:", decryptedBalance.toString());

    // Check if we have enough balance
    const totalNeeded = amountPerRecipient * BigInt(recipients.length);
    if (BigInt(decryptedBalance.toString()) < totalNeeded) {
      console.warn("⚠️  Warning: Insufficient token balance for transfer!");
      console.warn(`   Need: ${totalNeeded}, Have: ${decryptedBalance.toString()}`);
    }
  } catch (error: any) {
    console.error("⚠️  Could not decrypt balance:", error.message);
    console.log("💡 This is okay for testing - continuing with the transfer...");
  }

  // Step 2: Encrypt the amount for the batch transfer
  console.log("\n🔐 Step 2: Encrypting transfer amount...");
  const eAmountPerRecipient = await fhevm.encrypt64(Number(amountPerRecipient));
  console.log("📦 Encrypted amount handle:", eAmountPerRecipient.handle);
  console.log("🔐 Input proof length:", eAmountPerRecipient.inputProof.length);

  // Step 3: Set batcher as operator
  console.log("\n📝 Step 3: Setting batcher contract as operator...");
  const operatorTx = await token.setOperator(BATCHER_ADDRESS, ethers.MaxUint256);
  const operatorReceipt = await operatorTx.wait();
  console.log("🔗 SetOperator transaction hash:", operatorReceipt?.hash);
  console.log("✅ Operator set confirmed");

  // Step 4: Execute batch transfer
  console.log("\n📤 Step 4: Executing batch transfer...");
  try {
    const batchTx = await batcher.batchSendTokenSameAmount(
      TOKEN_ADDRESS,
      recipients,
      eAmountPerRecipient.handle,
      eAmountPerRecipient.inputProof
    );

    console.log("⏳ Waiting for transaction confirmation...");
    const batchReceipt = await batchTx.wait();
    console.log("✅ Batch transfer successful!");
    console.log("🔗 Transaction hash:", batchReceipt?.hash);
    console.log("⛽ Gas used:", batchReceipt?.gasUsed.toString());

    // Step 5: Verify recipient balances (optional)
    console.log("\n📊 Step 5: Verifying recipient balances...");

    for (const recipient of recipients) {
      try {
        // Make recipient balance publicly decryptable
        console.log(`\n🔍 Checking balance for ${recipient}...`);
        const makeRecipientTx = await batcher.makeBalancePubliclyDecryptable(TOKEN_ADDRESS, recipient);
        await makeRecipientTx.wait();

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Decrypt balance
        const recipientBalance = await token.confidentialBalanceOf(recipient);
        const decryptedRecipientBalance = await fhevm.publicDecrypt(recipientBalance);
        console.log(`✅ ${recipient}: ${decryptedRecipientBalance.toString()} tokens`);
      } catch (error: any) {
        console.log(`⚠️  Could not verify balance for ${recipient}: ${error.message}`);
      }
    }

    console.log("\n🎉 Batch transfer test completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Batch transfer failed:", error.message);

    if (error.message.includes("InsufficientTokenBalance")) {
      console.error("💡 Error: Sender has insufficient token balance");
    } else if (error.message.includes("InsufficientTokenAllowance")) {
      console.error("💡 Error: Operator not authorized or operator authorization expired");
    } else if (error.message.includes("BatchSizeExceeded")) {
      console.error("💡 Error: Too many recipients (max:", await batcher.MAX_BATCH_SIZE(), ")");
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
