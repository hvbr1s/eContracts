import { ethers } from 'ethers';
import hre from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// METAMASK WALLET
const PK = process.env.METAMASK_PK!;

// CONTRACTS
const ETOKEN_CONTRACT = "0x4A8C427Ebe0b22427d23Bbf518fd4A3017a3a4A4";
// const BATCHER_CONTRACT_ADDRESS = "0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9";
const BATCHER_CONTRACT_ADDRESS = "0x057E1f792c5D14CB050d3Df05512AfB862F1Ada3";
const RECIPIENTS = ["0xF659feEE62120Ce669A5C45Eb6616319D552dD93", "0xED8315fA2Ec4Dd0dA9870Bf8CD57eBf256A90772"];

const BATCHER_ABI = [
    "function batchSendTokenSameAmount(address token, address[] calldata recipients, bytes32 amountPerRecipient, bytes calldata inputProof) external",
    "function batchSendTokenDifferentAmounts(address token, address[] calldata recipients, bytes32[] calldata amounts, bytes[] calldata inputProofs) external",
    "event BatchTokenTransfer(address indexed sender, address indexed token, bytes32 totalAmount, uint256 recipients)"
];

const ETOKEN_ABI = [
    "function setOperator(address operator, uint48 until) external",
    "function isOperator(address holder, address spender) external view returns (bool)",
    "function confidentialBalanceOf(address account) external view returns (uint256)"
];

async function main() {
    try {
        console.log("Starting FHE batch transfer...");

        await hre.fhevm.initializeCLIApi();
        console.log("✅ FHE instance initialized via Hardhat plugin");

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com");
        const wallet = new ethers.Wallet(PK, provider);

        const amountPerRecipient = 1000;

        // Encrypt the amount per recipient using FHEVM v0.9 API
        const eAmountPerRecipient = await hre.fhevm
            .createEncryptedInput(BATCHER_CONTRACT_ADDRESS, wallet.address)
            .add64(BigInt(amountPerRecipient))
            .encrypt();

        console.log("📦 Encrypted amount handle:", eAmountPerRecipient.handles);
        console.log("🔐 Input proof length:", eAmountPerRecipient.inputProof?.length || 0);

        console.log("🔍 Wallet address:", wallet.address);
        console.log("🔍 Recipients:", RECIPIENTS);
        console.log("🔍 Amount per recipient:", amountPerRecipient);

        // Create contract instances
        const eTokenContract = new ethers.Contract(ETOKEN_CONTRACT, ETOKEN_ABI, wallet);
        const batcherContract = new ethers.Contract(BATCHER_CONTRACT_ADDRESS, BATCHER_ABI, wallet);

        // Step 1: Set batcher contract as operator (ONLY REQUIRED ONCE!)
        console.log("\n📝 Step 1: Setting batcher contract as operator...");
        // Set operator with expiration time (max uint48 for permanent)
        const until = 0xFFFFFFFFFFFF; // Max uint48 value

        const approveTx = await eTokenContract.setOperator!(
            BATCHER_CONTRACT_ADDRESS,
            until
        );
        console.log("🔗 SetOperator transaction hash:", approveTx.hash);
        await approveTx.wait();
        console.log("✅ Operator set confirmed");

        // Step 2: Execute batch transfer
        console.log("\n📤 Step 2: Executing batch transfer...");

        const handleAsBytes = eAmountPerRecipient.handles[0];

        const balance = await provider.getBalance(wallet.address);
        console.log("⛽ Wallet balance:", ethers.formatEther(balance), "ETH");

        // FHEVM v0.9: Check token balance with proper public decryption workflow
        console.log("\n🔐 Checking token balance...");
        try {
            // Step 1: Make the balance publicly decryptable
            console.log("📝 Making balance publicly decryptable...");
            const makeBalanceABI = ["function makeBalancePubliclyDecryptable() external returns (uint256)"];
            const tokenWithMakeBalance = new ethers.Contract(ETOKEN_CONTRACT, [...ETOKEN_ABI, ...makeBalanceABI], wallet);
            const makeTx = await tokenWithMakeBalance.makeBalancePubliclyDecryptable!();
            await makeTx.wait();
            console.log("✅ Balance marked as publicly decryptable");

            // Step 2: Wait for coprocessor to process
            console.log("⏳ Waiting for coprocessor to process...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Now get and decrypt the balance
            const encryptedBalance = await eTokenContract.confidentialBalanceOf!(wallet.address);
            const balanceHandleHex = ethers.toBeHex(encryptedBalance, 32);
            console.log("📦 Encrypted balance handle:", balanceHandleHex);

            const decryptionResult = await hre.fhevm.publicDecrypt([balanceHandleHex]);
            const balanceValue = decryptionResult.clearValues[balanceHandleHex as `0x${string}`];

            if (balanceValue) {
                console.log("🔓 Decrypted token balance:", balanceValue.toString());
            } else {
                console.log("⚠️  Token balance is zero or uninitialized");
            }
        } catch (error: any) {
            console.log("⚠️  Could not decrypt balance:", error.message);
            if (error.message.includes("not allowed for public decryption")) {
                console.log("💡 Tip: Make sure the balance is publicly decryptable first");
            }
        }

        try {
            const gasEstimate = await batcherContract.batchSendTokenSameAmount!.estimateGas(
                ETOKEN_CONTRACT,
                RECIPIENTS,
                handleAsBytes,
                eAmountPerRecipient.inputProof
            );
            console.log("⛽ Gas estimate:", gasEstimate.toString());
        } catch (gasError: any) {
            console.error("❌ Gas estimation failed:", gasError.message);
            if (gasError.data) {
                console.log("🔍 Error data:", gasError.data);
            }
        }

        const tx = await batcherContract.batchSendTokenSameAmount!(
            ETOKEN_CONTRACT,
            RECIPIENTS,
            handleAsBytes,
            eAmountPerRecipient.inputProof
        );

        console.log("🔗 Batch transfer transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

        const batchEvent = receipt.logs.find((log: any) => {
            try {
                const parsed = batcherContract.interface.parseLog(log);
                return parsed?.name === 'BatchTokenTransfer';
            } catch {
                return false;
            }
        });

        if (batchEvent) {
            const parsed = batcherContract.interface.parseLog(batchEvent);
            console.log("\n📨 BatchTokenTransfer Event Emitted:");
            console.log("  Sender:", parsed!.args.sender);
            console.log("  Token:", parsed!.args.token);
            console.log("  Recipients count:", parsed!.args.recipients.toString());
            console.log("  Total encrypted amount:", parsed!.args.totalAmount);
        }

        console.log("\n✅ Batch transfer complete!");
        console.log(`📊 Sent ${amountPerRecipient} tokens to ${RECIPIENTS.length} recipients`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

main().catch(console.error);
