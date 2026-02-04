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
  timeoutDurationMs: 6000000 // 10 minutes
};

async function main() {
  const provider = await getProvider(config);
  if (!provider) throw new Error("Failed to initialize provider");
  const web3Provider = new hre.ethers.BrowserProvider(provider);

  const deployer = await web3Provider.getSigner();
  console.log("Deployer address", await deployer.getAddress());

  const contractOwner = process.env.FORDEFI_EVM_VAULT_ADDRESS;

  const factory = await hre.ethers.getContractFactory("eBatcher7984Upgradeable", deployer);
  console.log("Deploying upgradeable contract...");

  console.log("\nDeploying proxy and implementation...");
  const proxy = await hre.upgrades.deployProxy(factory, [contractOwner], {
    initializer: "initialize",
    kind: "uups",
    timeout: 600000, // 10 minutes
    pollingInterval: 5000, // 5 seconds.
    txOverrides:{
      gasLimit: 5000000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1000000000n
    }
  });

  let proxyAddress;
  try {
    await proxy.waitForDeployment();
    proxyAddress = await proxy.getAddress();
    console.log("\n✅ Proxy deployed to:", proxyAddress);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log("⚠️  Deployment timed out, but checking if it succeeded...");
    console.log("Error:", error.message);
    try {
      proxyAddress = await proxy.getAddress();
      console.log("\n✅ Proxy deployed to:", proxyAddress);
    } catch (e) {
      console.log(e);
      throw new Error("Failed to get proxy address after timeout");
    }
  }

  // Get implementation address
  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("📝 Implementation deployed to:", implementationAddress);

  // Verify the deployment
  const maxBatchSize = await proxy.MAX_BATCH_SIZE();
  const owner = await proxy.owner();
  const version = await proxy.version();

  console.log("\n📊 Contract State:");
  console.log("   MAX_BATCH_SIZE:", maxBatchSize.toString());
  console.log("   Owner:", owner);
  console.log("   Version:", version);

  console.log("\n🎉 Deployment complete!");
  console.log("\n⚠️  Save these addresses:");
  console.log("   Proxy:", proxyAddress);
  console.log("   Implementation:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
