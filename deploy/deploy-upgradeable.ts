import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-ethers";
import { getProvider } from "./get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config()

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_MACBOOK_PRO_BOT!
const PEM_PRIVATE_KEY = fs.readFileSync('./secrets/private2.pem', 'utf8')
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS!
const RPC_URL = process.env.ALCHEMY_RPC!

const config: FordefiProviderConfig = {
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: 11155111,
    rpcUrl: RPC_URL,
};

async function main() {
    let provider = await getProvider(config);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new hre.ethers.BrowserProvider(provider); 
  
    const deployer = await web3Provider.getSigner();
    console.log("Deployer address", await deployer.getAddress());

    const contractOwner = "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73";

    const factory = await hre.ethers.getContractFactory("eBatcher7984Upgradeable", deployer);
    console.log('Deploying upgradeable contract...');

    console.log("\nDeploying proxy and implementation...");
    const proxy = await hre.upgrades.deployProxy(
        factory,
        [contractOwner],
        {
        initializer: 'initialize',
        kind: 'uups'
        }
    );
    try {
        await proxy.waitForDeployment();
    } catch (error) {
        console.log(error)
    }
    const proxyAddress = await proxy.getAddress();
    console.log("\n✅ Proxy deployed to:", proxyAddress);

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
    .catch(error => {
        console.error(error);
        process.exit(1);
    });