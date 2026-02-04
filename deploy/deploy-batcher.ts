import fs from "fs";
import hre from "hardhat";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-ethers";
import { getProvider } from "./get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config();

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN!;
const PEM_PRIVATE_KEY = fs.readFileSync("./secrets/private.pem", "utf8");
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS!;
const RPC_URL = process.env.ALCHEMY_RPC_MAINNET!;

const config: FordefiProviderConfig = {
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  chainId: 1,
  rpcUrl: RPC_URL,
  skipPrediction: true,
  timeoutDurationMs: 600000 // 10 minutes
};

async function main() {
  const provider = await getProvider(config);
  if (!provider) throw new Error("Failed to initialize provider");
  const web3Provider = new hre.ethers.BrowserProvider(provider);

  const deployer = await web3Provider.getSigner();
  console.log("Deployer address:", await deployer.getAddress());

  const contractOwner = process.env.FORDEFI_EVM_VAULT_ADDRESS;

  const factory = await hre.ethers.getContractFactory("eBatcher7984", deployer);
  console.log("Deploying eBatcher7984 (non-upgradeable)...");

  const contract = await factory.deploy(contractOwner, {
    gasLimit: 5000000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n
  });

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("\n✅ eBatcher7984 deployed to:", contractAddress);

  // Verify the deployment
  const maxBatchSize = await contract.MAX_BATCH_SIZE();
  const owner = await contract.owner();
  const version = await contract.version();

  console.log("\n📊 Contract State:");
  console.log("   MAX_BATCH_SIZE:", maxBatchSize.toString());
  console.log("   Owner:", owner);
  console.log("   Version:", version);

  console.log("\n🎉 Deployment complete!");
  console.log("\n⚠️  Save this address:");
  console.log("   Contract:", contractAddress);
  console.log("\n📝 To verify on Etherscan:");
  console.log(`   npx hardhat verify --network ethereum ${contractAddress} "${contractOwner}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
