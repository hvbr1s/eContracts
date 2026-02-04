import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
// import "@fhevm/hardhat-plugin"; // Disabled for mainnet - causes anvil_nodeInfo error
import dotenv from 'dotenv';

dotenv.config()

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 10000,
      },
      evmVersion: "prague",
    },
  },
  networks: {
    ethereum: { 
      url: "https://eth.llamarpc.com",
      chainId: 1,
    },
    base: { 
      url: "https://mainnet.base.org",
      chainId: 8453,
    },
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      timeout: 60000,
    },
    "ethereum-blockscout": {
      url: "https://eth.llamarpc.com",
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY!,
      ethereum: process.env.ETHERSCAN_API_KEY!,
      base: process.env.ETHERSCAN_API_KEY!,
      "ethereum-blockscout": "no-api-key-needed"
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "ethereum-blockscout",
        chainId: 1,
        urls: {
          apiURL: "https://eth.blockscout.com/api",
          browserURL: "https://eth.blockscout.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: true
  }
};

export default config;