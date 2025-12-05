# Zama Token - eBatcher7984

Smart contracts for batching confidential token transfers using Zama's FHE technology.

## Deployed Contracts (Sepolia)

**eBatcherUpgradeable**

- Proxy: `0x49239Eaf11c688152996a2A380AB715ac3583A4b`
- Implementation: `0x9E7f92428119EdE16e514D9571D0a0AA74F55Cea`

**eWrapper**: `0x11990923083aE0365Fb713922C506C396Bb6a29d`

**eBucks**: `0x0a10119bb664d9A153bd55F8d234c888C76181CC`

## Contract Features

- **batchSendTokenSameAmount**: Send the same encrypted token amount to multiple recipients
- **batchSendTokenDifferentAmounts**: Send different encrypted token amounts to multiple recipients
- **tokenRescue**: Owner-only function to rescue tokens accidentally sent to the contract
- **changeMaxBatchSize**: Owner-only function to modify the maximum batch size (between 2 and 10)

## Web Interface

A minimalistic Windows 95-inspired web interface is available in the [public/](public/) folder for interacting with the
batch transfer contracts.

### Features

- Check encrypted token balances
- Set batcher contract as operator
- Send batch transfers with same amount to multiple recipients
- Send batch transfers with different amounts to multiple recipients
- Full FHEVM encryption support
- MetaMask integration

### Quick Start

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Run Local Server

```bash
npm run serve
```

This will start a local HTTP server on port 8080.

#### 3. Open in Browser

Navigate to: `http://localhost:8080`

#### 4. Connect Wallet

Click "Connect Wallet" to connect your MetaMask wallet to the application.

### Web UI Configuration

Update the following addresses in the UI:

- **Token Address**: Your eBucks token contract address
- **Batcher Address**: Your eBatcher contract address

Default values are provided but can be changed in the Configuration section.

### Usage

#### Check Balance

1. Navigate to the "Check Balance" tab
2. Click "Check Balance"
3. Approve the transaction in MetaMask
4. Wait for the balance to be decrypted

#### Set Operator

1. Navigate to the "Set Operator" tab
2. (Optional) Adjust the "Valid Until" timestamp
3. Click "Set Operator"
4. Approve the transaction in MetaMask

#### Batch Transfer (Same Amount)

1. Navigate to the "Batch (Same Amount)" tab
2. Enter recipient addresses (one per line)
3. Enter the amount per recipient
4. Click "Send Batch (Same Amount)"
5. Approve the transaction in MetaMask

#### Batch Transfer (Different Amounts)

1. Navigate to the "Batch (Different Amounts)" tab
2. Enter recipients and amounts in format: `address,amount` (one per line)
3. Click "Send Batch (Different Amounts)"
4. Approve the transaction in MetaMask

### Web UI Deployment

For production deployment, you can use any static hosting service:

#### Vercel

```bash
npm install -g vercel
vercel --prod
```

#### Netlify

1. Build is not required (static files)
2. Deploy the `public` folder directly

#### GitHub Pages

1. Push the `public` folder to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Set the source to the `public` folder

#### Self-Hosted

Serve the `public` folder using any web server:

```bash
# Using Python
python -m http.server 8080 --directory public

# Using PHP
php -S localhost:8080 -t public

# Using Node.js http-server
npx http-server public -p 8080
```

### Important Notes

#### FHEVM Instance Persistence

The FHEVM instance is initialized when you connect your wallet and will persist throughout your session. The instance
includes:

- Chain ID configuration
- Public key from the Gateway contract
- Encryption/decryption capabilities

#### Network Requirements

- The app requires connection to a network with FHEVM support
- Gateway contract must be deployed at: `0x0000000000000000000000000000000000000044`
- Ensure your MetaMask is connected to the correct network

#### Browser Compatibility

- Modern browsers with ES6 module support
- MetaMask extension installed
- JavaScript enabled

### Troubleshooting

#### "MetaMask not detected"

- Install MetaMask browser extension
- Refresh the page after installation

#### "Connection failed"

- Check that you're on the correct network
- Ensure the network has FHEVM support

#### "Balance not ready yet"

- The coprocessor may need more time
- Wait a few seconds and try again

#### Transaction Failures

- Check you have sufficient ETH for gas
- Verify the batcher is set as operator
- Ensure sufficient token balance

### Web UI File Structure

```text
public/
├── index.html      # Main HTML structure
├── styles.css      # Windows 95-inspired styling
├── app.js          # Application logic and FHEVM integration
└── README.md       # Web UI documentation
```

### Technologies Used

- **Ethers.js v6**: Ethereum interaction
- **fhevmjs v0.9**: FHEVM encryption/decryption
- **Pure HTML/CSS/JS**: No build step required
- **ES6 Modules**: Modern JavaScript imports

## Contract Deployment

Deploy upgradeable contracts:

```bash
npm run deploy-upgrade
```

See [deploy/deploy-upgradeable.ts](deploy/deploy-upgradeable.ts) for deployment details.

## Configuration

### Environment Variables

Create a `.env` file:

```bash
FORDEFI_API_USER_MACBOOK_PRO_BOT=your_fordefi_api_token
FORDEFI_EVM_VAULT_ADDRESS=your_vault_address
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Compiler Settings

- **Solidity Version**: 0.8.27
- **Optimizer**: Enabled with 10000 runs
- **EVM Version**: prague

See [hardhat.config.ts](hardhat.config.ts) for full configuration.

## Verification

### Verify eBatcherUpgradeable Implementation

```bash
forge verify-contract \
  0xd76951e847b7AFE761c4768405851848b5Bcf143 \
  contracts/eBatcherUpgradable.sol:eBatcher7984Upgradeable \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --optimizer-runs 10000 \
  --evm-version prague \
  --watch
```

### Verify eWrapper (eWETH)

```bash
forge verify-contract \
  0x09cC7E09aB4905e5577936783cB71323f077b590 \
  contracts/eWETH.sol:eWETH \
  --chain sepolia \
  --compiler-version 0.8.27 \
  --optimizer-runs 10000 \
  --evm-version prague \
  --constructor-args $(cast abi-encode "constructor(string,string,string)" "Encrypted Wrapped Ether" "eWETH" "") \
  --watch
```

### Verify eBucks (Hardhat)

```bash
npx hardhat verify --network sepolia 0x09cC7E09aB4905e5577936783cB71323f077b590
```

### Verify eWrapper (Hardhat)

```bash
npx hardhat verify \
  --network sepolia \
  0xA968CbF4162aABEc9eDA0645382df0c2CBb47eA1 \
  "Encrypted Wrapped Ether" "eWETH" ""
```

### Verify eBatcher Implementation (Hardhat)
```bash
npx hardhat verify --network sepolia \
  --contract contracts/eBatcherUpgradable.sol:eBatcher7984Upgradeable \
  0xd76951e847b7AFE761c4768405851848b5Bcf143
```

For proxy verification, use Etherscan's "Verify as Proxy" feature after verifying the implementation.

## Security

- OpenZeppelin's ReentrancyGuard and Ownable contracts
- Zama's FHE (Fully Homomorphic Encryption) for confidential transfers
- ERC-7984 standard compliance

### Security Considerations

1. **Never commit private keys**: The UI uses MetaMask for signing
2. **Verify addresses**: Always double-check token and batcher addresses
3. **Test first**: Use testnet before mainnet deployment
4. **HTTPS in production**: Always use HTTPS for production deployments

## License

BSD-3-Clause-Clear
