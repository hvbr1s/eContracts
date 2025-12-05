# eBucks Batch Transfer Web UI

A minimalistic Windows 95-inspired web interface for interacting with FHEVM v0.9 batch transfers.

## Features

- Check encrypted token balances
- Set batcher contract as operator
- Send batch transfers with same amount to multiple recipients
- Send batch transfers with different amounts to multiple recipients
- Full FHEVM encryption support
- MetaMask integration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Local Server

```bash
npm run serve
```

This will start a local HTTP server on port 8080.

### 3. Open in Browser

Navigate to: `http://localhost:8080`

### 4. Connect Wallet

Click "Connect Wallet" to connect your MetaMask wallet to the application.

## Configuration

Update the following addresses in the UI:
- **Token Address**: Your eBucks token contract address
- **Batcher Address**: Your eBatcher contract address

Default values are provided but can be changed in the Configuration section.

## Usage

### Check Balance

1. Navigate to the "Check Balance" tab
2. Click "Check Balance"
3. Approve the transaction in MetaMask
4. Wait for the balance to be decrypted

### Set Operator

1. Navigate to the "Set Operator" tab
2. (Optional) Adjust the "Valid Until" timestamp
3. Click "Set Operator"
4. Approve the transaction in MetaMask

### Batch Transfer (Same Amount)

1. Navigate to the "Batch (Same Amount)" tab
2. Enter recipient addresses (one per line)
3. Enter the amount per recipient
4. Click "Send Batch (Same Amount)"
5. Approve the transaction in MetaMask

### Batch Transfer (Different Amounts)

1. Navigate to the "Batch (Different Amounts)" tab
2. Enter recipients and amounts in format: `address,amount` (one per line)
3. Click "Send Batch (Different Amounts)"
4. Approve the transaction in MetaMask

## Deployment

For production deployment, you can use any static hosting service:

### Vercel

```bash
npm install -g vercel
vercel --prod
```

### Netlify

1. Build is not required (static files)
2. Deploy the `public` folder directly

### GitHub Pages

1. Push the `public` folder to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Set the source to the `public` folder

### Self-Hosted

Serve the `public` folder using any web server:

```bash
# Using Python
python -m http.server 8080 --directory public

# Using PHP
php -S localhost:8080 -t public

# Using Node.js http-server
npx http-server public -p 8080
```

## Important Notes

### FHEVM Instance Persistence

The FHEVM instance is initialized when you connect your wallet and will persist throughout your session. The instance includes:
- Chain ID configuration
- Public key from the Gateway contract
- Encryption/decryption capabilities

### Network Requirements

- The app requires connection to a network with FHEVM support
- Gateway contract must be deployed at: `0x0000000000000000000000000000000000000044`
- Ensure your MetaMask is connected to the correct network

### Browser Compatibility

- Modern browsers with ES6 module support
- MetaMask extension installed
- JavaScript enabled

## Security Considerations

1. **Never commit private keys**: The UI uses MetaMask for signing
2. **Verify addresses**: Always double-check token and batcher addresses
3. **Test first**: Use testnet before mainnet deployment
4. **HTTPS in production**: Always use HTTPS for production deployments

## Troubleshooting

### "MetaMask not detected"
- Install MetaMask browser extension
- Refresh the page after installation

### "Connection failed"
- Check that you're on the correct network
- Ensure the network has FHEVM support

### "Balance not ready yet"
- The coprocessor may need more time
- Wait a few seconds and try again

### Transaction Failures
- Check you have sufficient ETH for gas
- Verify the batcher is set as operator
- Ensure sufficient token balance

## File Structure

```
public/
├── index.html      # Main HTML structure
├── styles.css      # Windows 95-inspired styling
├── app.js          # Application logic and FHEVM integration
└── README.md       # This file
```

## Technologies Used

- **Ethers.js v6**: Ethereum interaction
- **fhevmjs v0.9**: FHEVM encryption/decryption
- **Pure HTML/CSS/JS**: No build step required
- **ES6 Modules**: Modern JavaScript imports

## License

BSD-3-Clause-Clear
