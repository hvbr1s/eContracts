# Zama Token - eBatcher7984

This repository contains the eBatcher7984 smart contract for batching confidential token transfers using Zama's FHE technology.

## Contract Information

### Non-Upgradeable Deployment (Legacy)

- **Contract Name**: eBatcher7984
- **Network**: Ethereum Sepolia
- **Deployed Address**: `0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df`
- **Owner Address**: `0x83c1C2a52d56dFb958C52831a3D683cFAfC34c75`
- **Etherscan**: <https://sepolia.etherscan.io/address/0x6c2c8a3bd837f8f0c3286885ea17c17392af91df>

### Upgradeable Deployment (Current)

- **Contract Name**: eBatcher7984Upgradeable
- **Network**: Ethereum Sepolia
- **Proxy Address**: `0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9`
- **Implementation Address**: `0xCA3CD61d243D5B08f342C304ADD03dF5859eb6f7`
- **Owner Address**: `0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73`
- **Proxy Etherscan**: <https://sepolia.etherscan.io/address/0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9>
- **Implementation Etherscan**: <https://sepolia.etherscan.io/address/0xCA3CD61d243D5B08f342C304ADD03dF5859eb6f7>

## Deployment

The contract is deployed using Hardhat with the Fordefi Web3 provider.

### Deploy Commands

Non-upgradeable version:

```bash
npx hardhat run deploy/deploy.ts --network sepolia
```

Upgradeable version:

```bash
npm run deploy-upgrade
```

See [deploy/deploy-upgradeable.ts](deploy/deploy-upgradeable.ts) for the upgradeable deployment script.

## Verification

The contract uses specific compiler settings that must be matched for successful verification:

- **Solidity Version**: 0.8.27
- **Optimizer**: Enabled with 10000 runs
- **EVM Version**: prague

### Verify Non-Upgradeable Contract with Foundry

```bash
forge verify-contract \
  0x6c2C8A3Bd837f8F0c3286885ea17c17392af91df \
  contracts/eBatcher7984.sol:eBatcher7984 \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --constructor-args $(cast abi-encode "constructor(address)" "0x83c1C2a52d56dFb958C52831a3D683cFAfC34c75") \
  --optimizer-runs 10000 \
  --evm-version prague \
  --watch
```

### Verify Upgradeable Contract with Foundry

#### Step 1: Verify the Implementation Contract

```bash
forge verify-contract \
  0x36Ed686F54144046376f9f7D9dAa92447EC7e963 \
  contracts/eBatcherUpgradable.sol:eBatcher7984Upgradeable \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --optimizer-runs 10000 \
  --evm-version prague \
  --watch
```

#### Step 2: Verify the Proxy Contract

```bash
forge verify-contract \
  0xD49a2F55cDd08F5e248b68C2e0645B2bE6fb8Da9 \
  @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" "0xCA3CD61d243D5B08f342C304ADD03dF5859eb6f7" $(cast calldata "initialize(address)" "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73")) \
  --optimizer-runs 200 \
  --watch
```

Alternatively, use Etherscan's "Verify as Proxy" feature after verifying the implementation.

### Verify eToken7984 Contract with Foundry

```bash
forge verify-contract \
  0x837565f0A3456143C01505c3d339Bc43bFAbf533 \
  contracts/eToken7984.sol:eToken7984 \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --optimizer-runs 10000 \
  --evm-version prague \
  --watch
```

### Verify with Hardhat

```bash
npx hardhat verify --network sepolia \
  0x36Ed686F54144046376f9f7D9dAa92447EC7e963 \
  "0x83c1C2a52d56dFb958C52831a3D683cFAfC34c75"
```

or:

```bash
npx hardhat verify --network sepolia 0xCd0025b9a243104c02a46223A8d5d7b84F8aF42D "Encrypted Wrapped Ether" "eWETH" ""
```

Note: The Hardhat verification automatically uses the settings from [hardhat.config.ts](hardhat.config.ts).

or if the contract doesn't have constructors:

```bash
npx hardhat verify --network sepolia 0x3bbDcC93e2E3dcDF9984afb5AEBaa3de52FE5591
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
FORDEFI_API_USER_MACBOOK_PRO_BOT=your_fordefi_api_token
FORDEFI_EVM_VAULT_ADDRESS=your_vault_address
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Hardhat Configuration

The contract compilation settings are defined in [hardhat.config.ts](hardhat.config.ts):

```typescript
solidity: {
  version: "0.8.27",
  settings: {
    optimizer: {
      enabled: true,
      runs: 10000,
    },
    evmVersion: "prague",
  },
}
```

## Contract Features

The eBatcher7984 contract provides the following functionality:

- **batchSendTokenSameAmount**: Send the same encrypted token amount to multiple recipients
- **batchSendTokenDifferentAmounts**: Send different encrypted token amounts to multiple recipients
- **tokenRescue**: Owner-only function to rescue tokens accidentally sent to the contract
- **changeMaxBatchSize**: Owner-only function to modify the maximum batch size (between 2 and 10)

## Security

- Uses OpenZeppelin's ReentrancyGuard and Ownable contracts
- Implements Zama's FHE (Fully Homomorphic Encryption) for confidential transfers
- Complies with ERC-7984 standard for confidential token transfers

## Verify eWETH contract

```bash
forge verify-contract \
  0x08036B36B2d19Fe06D3c86b4c530289bE17FDC20 \
  contracts/eWETH.sol:eWETH \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --optimizer-runs 10000 \
  --evm-version prague \
  --constructor-args $(cast abi-encode "constructor(string,string,string)" "Encrypted Wrapped Ether" "eWETH" "") \
  --watch
```
