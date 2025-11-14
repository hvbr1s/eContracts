/**
 * FHEVM v0.9 Public Decryption Example
 *
 * This script demonstrates the new self-relaying public decryption workflow:
 * 1. Make the encrypted balance publicly decryptable (on-chain)
 * 2. Decrypt the balance off-chain using the relayer SDK
 * 3. (Optional) Verify the decrypted value on-chain using FHE.checkSignatures
 */

import { ethers } from "hardhat";
import { publicDecrypt } from "@zama-fhe/relayer-sdk";

async function main() {
  console.log("\n🔐 FHEVM v0.9 Balance Verification Example\n");

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("👤 Signer address:", signer.address);

  // Replace with your deployed token contract address
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
  const ACCOUNT_TO_CHECK = process.env.ACCOUNT_TO_CHECK || signer.address;

  if (!TOKEN_ADDRESS) {
    throw new Error("❌ Please set TOKEN_ADDRESS environment variable");
  }

  console.log("🪙 Token address:", TOKEN_ADDRESS);
  console.log("📋 Checking balance for:", ACCOUNT_TO_CHECK);

  // Get the token contract
  const token = await ethers.getContractAt("eToken7984", TOKEN_ADDRESS);

  console.log("\n📝 Step 1: Making balance publicly decryptable (on-chain)...");

  // Call the new function to make the balance publicly decryptable
  const tx = await token.makeBalancePubliclyDecryptable();
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed:", receipt?.hash);

  // Get the encrypted balance handle
  const encryptedBalance = await token.confidentialBalanceOf(ACCOUNT_TO_CHECK);
  const balanceHandle = ethers.toBeHex(encryptedBalance, 32);
  console.log("📦 Encrypted balance handle:", balanceHandle);

  console.log("\n🔓 Step 2: Decrypting balance off-chain...");

  try {
    // Use the FHEVM Hardhat plugin's fhevm instance for decryption
    const fhevm = (global as any).fhevm;
    if (!fhevm) {
      throw new Error("FHEVM instance not initialized. Make sure @fhevm/hardhat-plugin is loaded.");
    }

    // Decrypt the balance using the relayer SDK
    const decryptedBalance = await fhevm.publicDecrypt(encryptedBalance);
    console.log("✅ Decrypted balance:", decryptedBalance.toString());

    // Alternative: Use publicDecrypt directly from @zama-fhe/relayer-sdk
    // const result = await publicDecrypt({
    //   handle: balanceHandle,
    //   chainId: (await ethers.provider.getNetwork()).chainId,
    // });
    // console.log("✅ Decrypted balance:", result.cleartext);
    // console.log("📝 Decryption proof:", result.proof);

    console.log("\n✅ Balance verification complete!");
    console.log(`📊 Account ${ACCOUNT_TO_CHECK} has ${decryptedBalance.toString()} tokens`);

  } catch (error: any) {
    console.error("❌ Decryption failed:", error.message);
    console.error("\n💡 Possible issues:");
    console.error("   1. The balance handle may not be publicly decryptable yet");
    console.error("   2. You may need to wait a few blocks after calling makeBalancePubliclyDecryptable()");
    console.error("   3. The relayer SDK may not be configured correctly");
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
