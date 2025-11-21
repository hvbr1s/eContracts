/**
 * Check Balance Script for eBucks Token (FHEVM v0.9)
 *
 * This script checks the balance of a Metamask account by:
 * 1. Retrieving the encrypted balance handle
 * 2. Generating a keypair for decryption
 * 3. Creating and signing an EIP-712 request
 * 4. Decrypting the balance using userDecrypt with the signed request
 */

import { ethers as ethersLib } from "ethers";
import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("\n🔍 Starting balance check for eBucks token...\n");

  // Initialize FHEVM instance
  await hre.fhevm.initializeCLIApi();
  console.log("✅ FHE instance initialized via Hardhat plugin");

  // Use Metamask wallet
  const PK = process.env.METAMASK_PK!;
  if (!PK) {
    throw new Error("❌ Please set METAMASK_PK in your .env file");
  }

  const provider = new ethersLib.JsonRpcProvider(process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com");
  const wallet = new ethersLib.Wallet(PK, provider);
  console.log("👤 Wallet address:", wallet.address);

  // Configuration - update with your deployed eBucks contract address
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xf56E699703A1e8128567a109CA41dA7B175A3570";
  console.log("🪙 eBucks token address:", TOKEN_ADDRESS);

  // Get the eBucks contract with the wallet as signer
  const token = new ethersLib.Contract(
    TOKEN_ADDRESS,
    [
      "function confidentialBalanceOf(address account) external view returns (uint256)",
      "function decimals() external view returns (uint8)",
      "function name() external view returns (string)",
      "function symbol() external view returns (string)",
    ],
    wallet,
  );

  // Step 1: Get token info
  console.log("\n📋 Token Information:");
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
  } catch (error: any) {
    console.log("⚠️  Could not fetch token info:", error.message);
  }

  // Step 2: Check ETH balance
  console.log("\n⚡ Wallet ETH Balance:");
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`   ${ethersLib.formatEther(ethBalance)} ETH`);

  // Step 3: Get the encrypted balance handle
  console.log("\n📦 Step 1: Retrieving encrypted balance handle...");
  try {
    const encryptedBalance = await token.confidentialBalanceOf(wallet.address);
    const ciphertextHandle = ethersLib.toBeHex(encryptedBalance, 32);
    console.log("📦 Encrypted balance handle:", ciphertextHandle);

    // Step 4: Generate keypair for decryption
    console.log("\n🔑 Step 2: Generating decryption keypair...");
    const keypair = hre.fhevm.generateKeypair();
    console.log("✅ Keypair generated");

    // Step 5: Prepare decryption request parameters
    console.log("\n📝 Step 3: Preparing decryption request...");
    const contractAddress = TOKEN_ADDRESS;
    const handleContractPairs = [
      {
        handle: ciphertextHandle,
        contractAddress: contractAddress,
      },
    ];
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    const contractAddresses = [contractAddress];

    // Step 6: Create EIP-712 signature
    console.log("\n✍️  Step 4: Creating and signing EIP-712 request...");
    const eip712 = hre.fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

    const signature = await wallet.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message,
    );
    console.log("✅ EIP-712 signature created");

    // Step 7: Decrypt the balance using userDecrypt
    console.log("\n🔓 Step 5: Decrypting balance...");
    const result = await hre.fhevm.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      wallet.address,
      startTimeStamp,
      durationDays,
    );

    const decryptedBalance = result[ciphertextHandle];

    if (decryptedBalance !== undefined && decryptedBalance !== null) {
      console.log("\n✅ BALANCE RETRIEVED SUCCESSFULLY!");
      console.log("━".repeat(50));
      console.log(`💰 Token Balance: ${decryptedBalance.toString()}`);
      console.log("━".repeat(50));
    } else {
      console.log("⚠️  Balance decryption returned no value");
      console.log("💡 The balance might still be processing by the coprocessor");
      console.log("💡 Try running the script again in a few seconds");
    }
  } catch (error: any) {
    console.error("\n❌ Error checking balance:", error.message);

    if (error.message.includes("insufficient funds")) {
      console.error("💡 You need ETH for gas fees");
    } else if (error.message.includes("nonce")) {
      console.error("💡 Nonce issue - try again in a moment");
    } else {
      console.error("💡 Full error:", error);
    }

    throw error;
  }

  console.log("\n✨ Balance check completed!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
