/**
 * FHEVM v0.9 Batch Transfer Test Script
 *
 * This script tests the eBatcher contract with proper FHEVM v0.9 public decryption workflow
 */

import { ethers as ethersLib } from "ethers";
import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("\n🚀 Starting FHE batch transfer test (FHEVM v0.9)...\n");

  // Initialize FHEVM instance
  await hre.fhevm.initializeCLIApi();
  console.log("✅ FHE instance initialized via Hardhat plugin");

  // Use Metamask wallet instead of default hardhat signer
  const PK = process.env.METAMASK_PK!;
  if (!PK) {
    throw new Error("❌ Please set METAMASK_PK in your .env file");
  }

  const provider = new ethersLib.JsonRpcProvider(process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com");
  const wallet = new ethersLib.Wallet(PK, provider);
  console.log("👤 Wallet address:", wallet.address);

  // Configuration - update these with your deployed contract addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
  const BATCHER_ADDRESS = process.env.BATCHER_ADDRESS || "";

  if (!TOKEN_ADDRESS || !BATCHER_ADDRESS) {
    throw new Error("❌ Please set TOKEN_ADDRESS and BATCHER_ADDRESS environment variables");
  }

  console.log("🪙 Token address:", TOKEN_ADDRESS);
  console.log("📦 Batcher address:", BATCHER_ADDRESS);

  // Get contracts with the wallet as signer
  const token = new ethersLib.Contract(
    TOKEN_ADDRESS,
    [
      "function setOperator(address operator, uint48 until) external",
      "function confidentialBalanceOf(address account) external view returns (uint256)",
      "function makeBalancePubliclyDecryptable() external returns (uint256)",
    ],
    wallet,
  );

  const batcher = new ethersLib.Contract(
    BATCHER_ADDRESS,
    [
      "function batchSendTokenSameAmount(address token, address[] calldata recipients, bytes32 amountPerRecipient, bytes calldata inputProof) external",
      "function MAX_BATCH_SIZE() external view returns (uint16)",
      "function makeBalancePubliclyDecryptable(address token, address account) external returns (uint256)",
    ],
    wallet,
  );

  // Test configuration
  const recipients = [
    process.env.RECIPIENT_1 || "0xF659feEE62120Ce669A5C45Eb6616319D552dD93",
    process.env.RECIPIENT_2 || "0xED8315fA2Ec4Dd0dA9870Bf8CD57eBf256A90772",
    process.env.RECIPIENT_3 || "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  ];
  const amountPerRecipient = 100000000n;

  console.log("📋 Recipients:", recipients);
  console.log("💰 Amount per recipient:", amountPerRecipient.toString());

  // Step 1: Check initial balance (FHEVM v0.9 way)
  console.log("\n📊 Step 1: Checking wallet balance...");
  console.log("⚡ Wallet ETH balance:", ethersLib.formatEther(await provider.getBalance(wallet.address)), "ETH");

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
    const balanceHandle = ethersLib.toBeHex(encryptedBalance, 32);
    console.log("📦 Encrypted balance handle:", balanceHandle);

    const decryptionResult = await hre.fhevm.publicDecrypt([balanceHandle]);
    const decryptedBalance = decryptionResult.clearValues[balanceHandle as `0x${string}`];
    console.log("✅ Decrypted token balance:", decryptedBalance?.toString() || "0");

    // Check if we have enough balance
    const totalNeeded = amountPerRecipient * BigInt(recipients.length);
    if (decryptedBalance && BigInt(decryptedBalance.toString()) < totalNeeded) {
      console.warn("⚠️  Warning: Insufficient token balance for transfer!");
      console.warn(`   Need: ${totalNeeded}, Have: ${decryptedBalance.toString()}`);
    }
  } catch (error: any) {
    console.error("⚠️  Could not decrypt balance:", error.message);
    console.log("💡 This is okay for testing - continuing with the transfer...");
  }

  // Step 2: Encrypt the amount for the batch transfer
  console.log("\n🔐 Step 2: Encrypting transfer amount...");
  const eAmountPerRecipient = await hre.fhevm
    .createEncryptedInput(BATCHER_ADDRESS, wallet.address)
    .add64(amountPerRecipient)
    .encrypt();
  console.log("📦 Encrypted amount handle:", eAmountPerRecipient.handles[0]);
  console.log("🔐 Input proof length:", eAmountPerRecipient.inputProof?.length || 0);

  // // Step 3: Set batcher as operator
  // console.log("\n📝 Step 3: Setting batcher contract as operator...");
  // const until = 0xffffffffffff; // Max uint48 value
  // const operatorTx = await token.setOperator(BATCHER_ADDRESS, until);
  // const operatorReceipt = await operatorTx.wait();
  // console.log("🔗 SetOperator transaction hash:", operatorReceipt?.hash);
  // console.log("✅ Operator set confirmed");

  // Step 4: Execute batch transfer
  console.log("\n📤 Step 4: Executing batch transfer...");
  try {
    const batchTx = await batcher.batchSendTokenSameAmount(
      TOKEN_ADDRESS,
      recipients,
      eAmountPerRecipient.handles[0],
      eAmountPerRecipient.inputProof,
    );

    console.log("⏳ Waiting for transaction confirmation...");
    const batchReceipt = await batchTx.wait();
    console.log("✅ Batch transfer successful!");
    console.log("🔗 Transaction hash:", batchReceipt?.hash);
    console.log("⛽ Gas used:", batchReceipt?.gasUsed.toString());

    console.log("\n🎉 Batch transfer test completed successfully!");
    console.log("💡 Recipient balances remain confidential - recipients can check their own balances if desired");
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
