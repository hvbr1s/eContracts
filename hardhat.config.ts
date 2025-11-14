import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import "@fhevm/hardhat-plugin";
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
    base: { 
      url: "https://mainnet.base.org",
      chainId: 8453,
    },
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      timeout: 60000,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  sourcify: {
    enabled: true
  }
};

export default config;