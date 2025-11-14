import { ethers } from 'ethers';
import hre from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// METAMASK WALLET
const PK = process.env.METAMASK_PK!;

// CONTRACT
// const EWETH_CONTRACT = "0x08036B36B2d19Fe06D3c86b4c530289bE17FDC20";
const EWETH_CONTRACT = "0x241dbEaAE2a63a862CF728B020A10bDfFA853cE4";

const EWETH_ABI = [
    "function deposit() external payable",
    "function withdraw(bytes32 amount, bytes calldata inputProof) external",
    "function completeWithdrawal(bytes32 handle, bytes calldata cleartexts, bytes calldata decryptionProof) external",
    "function confidentialBalanceOf(address account) external view returns (uint256)",
    "function withdrawalRequests(bytes32 handle) external view returns (address user, bool isPending)",
    "function makeBalancePubliclyDecryptable() external returns (uint256)",
    "function makeBalancePubliclyDecryptableFor(address account) external returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "event Deposit(address indexed dest, uint256 amount)",
    "event Withdrawal(address indexed source, uint64 amount)",
    "event WithdrawalRequested(address indexed source, bytes32 indexed handle)"
];

async function main() {
    // HARDCODED VALUES - Change these as needed
    const action: "deposit" | "withdraw" = "deposit";
    const amount = "1000000000000000"; // amount in wei (0.001 ETH)

    try {
        console.log(`\n🚀 Starting eWETH ${action}...`);

        await hre.fhevm.initializeCLIApi();
        console.log("✅ FHE instance initialized via Hardhat plugin");

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com");
        const wallet = new ethers.Wallet(PK, provider);

        console.log("🔍 Wallet address:", wallet.address);
        console.log("🔍 eWETH contract:", EWETH_CONTRACT);

        const eWETHContract = new ethers.Contract(EWETH_CONTRACT, EWETH_ABI, wallet);

        // Display contract info
        const tokenName = await eWETHContract.name!();
        const tokenSymbol = await eWETHContract.symbol!();
        console.log(`📝 Token: ${tokenName} (${tokenSymbol})`);

        if (action === "deposit") {
            await performDeposit(wallet, eWETHContract, amount);
        } else if (action === "withdraw") {
            await performWithdraw(wallet, eWETHContract, amount);
        }

        // Display encrypted balance after operation
        await displayEncryptedBalance(wallet, eWETHContract);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

async function performDeposit(wallet: ethers.Wallet, contract: ethers.Contract, amount: string) {
    console.log("\n💰 Performing deposit...");
    console.log("📊 Amount:", ethers.formatEther(amount), "ETH");

    // Check if amount exceeds uint64.max
    const uint64Max = BigInt("18446744073709551615");
    if (BigInt(amount) > uint64Max) {
        console.error(`❌ Error: Amount exceeds uint64 max (${ethers.formatEther(uint64Max.toString())} ETH)`);
        process.exit(1);
    }

    const balance = await wallet.provider!.getBalance(wallet.address);
    console.log("⛽ Wallet balance:", ethers.formatEther(balance), "ETH");

    if (balance < BigInt(amount)) {
        console.error("❌ Error: Insufficient ETH balance");
        process.exit(1);
    }

    try {
        const gasEstimate = await contract.deposit!.estimateGas({ value: amount });
        console.log("⛽ Gas estimate:", gasEstimate.toString());
    } catch (gasError: any) {
        console.error("❌ Gas estimation failed:", gasError.message);
    }

    const tx = await contract.deposit!({ value: amount });
    console.log("🔗 Deposit transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Parse Deposit event
    const depositEvent = receipt.logs.find((log: any) => {
        try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === 'Deposit';
        } catch {
            return false;
        }
    });

    if (depositEvent) {
        const parsed = contract.interface.parseLog(depositEvent);
        console.log("\n📨 Deposit Event Emitted:");
        console.log("  Destination:", parsed!.args.dest);
        console.log("  Amount:", ethers.formatEther(parsed!.args.amount), "ETH");
    }

    console.log("\n✅ Deposit complete!");
}

async function performWithdraw(wallet: ethers.Wallet, contract: ethers.Contract, amount: string) {
    console.log("\n💸 Performing withdrawal (FHEVM v0.9 two-step process)...");
    console.log("📊 Amount:", ethers.formatEther(amount), "ETH");

    // Check if amount exceeds uint64.max
    const uint64Max = BigInt("18446744073709551615");
    if (BigInt(amount) > uint64Max) {
        console.error(`❌ Error: Amount exceeds uint64 max (${ethers.formatEther(uint64Max.toString())} ETH)`);
        process.exit(1);
    }

    // STEP 1: Initiate withdrawal request
    console.log("\n🔹 STEP 1: Initiating withdrawal request...");

    // Encrypt the withdrawal amount using FHEVM v0.9 API
    const eWithdrawAmount = await hre.fhevm
        .createEncryptedInput(EWETH_CONTRACT, wallet.address)
        .add64(BigInt(amount))
        .encrypt();

    console.log("📦 Encrypted amount handle:", eWithdrawAmount.handles[0]);
    console.log("🔐 Input proof length:", eWithdrawAmount.inputProof?.length || 0);

    const handleAsBytes = eWithdrawAmount.handles[0];

    const tx = await contract.withdraw!(
        handleAsBytes,
        eWithdrawAmount.inputProof
    );

    console.log("🔗 Withdrawal request transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

    // Parse WithdrawalRequested event to get the handle
    const withdrawalRequestedEvent = receipt.logs.find((log: any) => {
        try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === 'WithdrawalRequested';
        } catch {
            return false;
        }
    });

    if (!withdrawalRequestedEvent) {
        console.error("❌ WithdrawalRequested event not found");
        return;
    }

    const parsed = contract.interface.parseLog(withdrawalRequestedEvent);
    const handle = parsed!.args.handle;
    console.log("\n📨 WithdrawalRequested Event Emitted:");
    console.log("  Source:", parsed!.args.source);
    console.log("  Handle:", handle);

    // STEP 2: Perform off-chain decryption and complete withdrawal
    console.log("\n🔹 STEP 2: Performing off-chain decryption...");

    try {
        // Use publicDecrypt from hre.fhevm to get the cleartext and proof
        const decryptionResult = await hre.fhevm.publicDecrypt([handle]);

        console.log("🔓 Decryption result:", decryptionResult);

        // Get the cleartext value for this handle
        const cleartextValue = decryptionResult.clearValues[handle];
        if (!cleartextValue) {
            throw new Error(`No cleartext value found for handle ${handle}`);
        }

        console.log("🔓 Decrypted amount:", cleartextValue.toString(), "wei");
        console.log("🔓 Decrypted amount:", ethers.formatEther(cleartextValue.toString()), "ETH");
        console.log("📝 Decryption proof length:", decryptionResult.decryptionProof.length);

        // STEP 3: Complete the withdrawal with the decrypted value and proof
        console.log("\n🔹 STEP 3: Completing withdrawal with proof verification...");

        const completeTx = await contract.completeWithdrawal!(
            handle,
            decryptionResult.abiEncodedClearValues,
            decryptionResult.decryptionProof
        );

        console.log("🔗 Complete withdrawal transaction hash:", completeTx.hash);

        const completeReceipt = await completeTx.wait();
        console.log("✅ Transaction confirmed in block:", completeReceipt.blockNumber);

        // Parse Withdrawal event
        const withdrawalEvent = completeReceipt.logs.find((log: any) => {
            try {
                const parsed = contract.interface.parseLog(log);
                return parsed?.name === 'Withdrawal';
            } catch {
                return false;
            }
        });

        if (withdrawalEvent) {
            const withdrawalParsed = contract.interface.parseLog(withdrawalEvent);
            console.log("\n📨 Withdrawal Event Emitted:");
            console.log("  Source:", withdrawalParsed!.args.source);
            console.log("  Amount:", withdrawalParsed!.args.amount.toString(), "wei");
        }

        console.log("\n✅ Withdrawal complete! ETH transferred to your wallet.");
    } catch (error: any) {
        console.error("❌ Error during off-chain decryption or withdrawal completion:", error.message);
        console.log("\n⚠️  Withdrawal was initiated but not completed. You can retry by calling completeWithdrawal() manually with the handle:", handle);
    }
}

async function displayEncryptedBalance(wallet: ethers.Wallet, contract: ethers.Contract) {
    console.log("\n🔐 Checking balance...");

    try {
        // FHEVM v0.9: First make the balance publicly decryptable
        console.log("📝 Making balance publicly decryptable...");
        const makeTx = await contract.makeBalancePubliclyDecryptable!();
        await makeTx.wait();
        console.log("✅ Balance marked as publicly decryptable");

        // Wait for coprocessor to process the request
        console.log("⏳ Waiting for coprocessor to process...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get encrypted balance handle
        const encryptedBalance = await contract.confidentialBalanceOf!(wallet.address);
        const balanceHandleHex = ethers.toBeHex(encryptedBalance, 32);
        console.log("📦 Encrypted balance handle:", balanceHandleHex);

        // Now decrypt using the new public decryption workflow via hre.fhevm
        const decryptionResult = await hre.fhevm.publicDecrypt([balanceHandleHex]);

        // Get the cleartext value for this handle
        const balanceValue = decryptionResult.clearValues[balanceHandleHex as `0x${string}`];
        if (!balanceValue) {
            console.log("⚠️  Balance is zero or uninitialized");
            return;
        }

        console.log("🔓 Decrypted eWETH balance:", balanceValue.toString(), "wei");
        console.log("🔓 Decrypted eWETH balance:", ethers.formatEther(balanceValue.toString()), "ETH");
    } catch (error: any) {
        console.log("⚠️  Could not decrypt balance");
        console.log("Error details:", error.message);
        if (error.message.includes("not allowed for public decryption")) {
            console.log("💡 Tip: The balance needs to be marked as publicly decryptable first");
        }
    }
}

main().catch(console.error);
