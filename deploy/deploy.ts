import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-ethers";
import { getProvider } from "./get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config()

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
    let provider = await getProvider(config);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new hre.ethers.BrowserProvider(provider); 
  
    const signer = await web3Provider.getSigner();
    const signerAddress = await signer.getAddress();
    const factory = await hre.ethers.getContractFactory("eWETH", signer);
    console.log('Deploying contract...');

    // const initialAmount = 1000000000000; // 1 millie (6 decimals)
    const tokenName = "Encrypted Wrapped Ether";
    const tokenSymbol = "eWETH";
    const tokenURI = "";

    const contract = await factory.deploy(
        // "0x83c1C2a52d56dFb958C52831a3D683cFAfC34c75",  // owner
        // initialAmount,  // amount
        tokenName,      // name
        tokenSymbol,    // symbol
        tokenURI        // tokenURI
    );
    const ok = await contract.waitForDeployment();
    if (ok){
        console.log('Contract deployed to:', await contract.getAddress());
    } else {
        console.log("Error deploying")
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });