import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-ethers";
import { getProvider } from "./deploy/get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config()

const { upgrades } = require("hardhat");
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_MACBOOK_PRO_BOT ?? 
(() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './secrets/private2.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
(() => { throw new Error('PEM_PRIVATE_KEY is not set') })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ?? 
(() => { throw new Error('FORDEFI_EVM_VAULT_ADDRESS is not set') })();

const config: FordefiProviderConfig = {
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: 11155111,
    rpcUrl: "https://ethereum-sepolia.publicnode.com",
};

async function main() {
    // Replace this with your deployed proxy address
    const PROXY_ADDRESS = "YOUR_PROXY_ADDRESS_HERE";

    let provider = await getProvider(config);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new hre.ethers.BrowserProvider(provider); 

    const deployer = await web3Provider.getSigner();
  
    console.log("Upgrading eBatcher7984Upgradeable with account:", deployer.address);
    console.log("Proxy address:", PROXY_ADDRESS);

    // Get the new contract factory (e.g., eBatcher7984UpgradeableV2)
    const EBatcher7984UpgradeableV2 = await hre.ethers.getContractFactory("eBatcher7984Upgradeable");

    console.log("\nUpgrading contract...");
    
    // Upgrade the proxy to the new implementation
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, EBatcher7984UpgradeableV2);
    
    await upgraded.waitForDeployment();

    const proxyAddress = await upgraded.getAddress();
    console.log("✅ Proxy upgraded at:", proxyAddress);

    // Get new implementation address
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("📝 New implementation deployed to:", newImplementationAddress);

    // Verify the upgrade
    const maxBatchSize = await upgraded.MAX_BATCH_SIZE();
    const owner = await upgraded.owner();
    const version = await upgraded.version();

    console.log("\n📊 Contract State After Upgrade:");
    console.log("   MAX_BATCH_SIZE:", maxBatchSize.toString());
    console.log("   Owner:", owner);
    console.log("   Version:", version);

    console.log("\n🎉 Upgrade complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });