// Import ethers from CDN
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.0/+esm";

// Import from Zama's relayer SDK (supports encryption and user decryption)
import { initSDK, createInstance, SepoliaConfig } from "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js";

// Constants
const BATCHER_ADDRESS = "0x49239Eaf11c688152996a2A380AB715ac3583A4b";

// State
let provider = null;
let signer = null;
let fhevmInstance = null;
let userAddress = null;

// ABIs
const TOKEN_ABI = [
  "function confidentialBalanceOf(address account) external view returns (uint256)",
  "function makeBalancePubliclyDecryptable() external returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function setOperator(address operator, uint48 until) external",
];

const BATCHER_ABI = [
  "function batchSendTokenSameAmount(address token, address[] calldata recipients, bytes32 amountPerRecipient, bytes calldata inputProof) external",
  "function batchSendToken(address token, address[] calldata recipients, bytes32[] calldata amounts, bytes calldata inputProof) external",
  "function MAX_BATCH_SIZE() external view returns (uint16)",
];

// Initialize
async function init() {
  console.log("App initializing...");
  console.log("initSDK available:", !!initSDK);
  console.log("createInstance available:", !!createInstance);
  console.log("ethers available:", !!ethers);
  setupTabs();
  setupEventListeners();
  console.log("App initialized successfully");
}

// Setup tabs
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(tabName).classList.add("active");
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById("connectWallet").addEventListener("click", connectWallet);
  document.getElementById("checkBalance").addEventListener("click", checkBalance);
  document.getElementById("setOperator").addEventListener("click", setOperator);
  document.getElementById("batchTransferSame").addEventListener("click", batchTransferSame);
  document.getElementById("batchTransferDiff").addEventListener("click", batchTransferDiff);
}

// Connect Wallet
async function connectWallet() {
  const statusEl = document.getElementById("walletStatus");
  const networkStatusEl = document.getElementById("networkStatus");

  try {
    console.log("🔌 connectWallet() called");
    console.log("🔍 window.ethereum exists:", !!window.ethereum);
    console.log("🔍 ethers available:", !!ethers);
    console.log("🔍 initSDK available:", !!initSDK);

    if (!window.ethereum) {
      showError(statusEl, "MetaMask not detected! Please install MetaMask.");
      return;
    }

    showLoading(statusEl, "Connecting to MetaMask");
    console.log("📝 Creating BrowserProvider...");

    provider = new ethers.BrowserProvider(window.ethereum);
    console.log("✅ Provider created");

    console.log("📝 Requesting accounts...");
    await provider.send("eth_requestAccounts", []);
    console.log("✅ Accounts requested");

    console.log("📝 Getting signer...");
    signer = await provider.getSigner();
    console.log("✅ Signer obtained");

    userAddress = await signer.getAddress();
    console.log("✅ Connected to wallet:", userAddress);

    // Initialize FHEVM using relayer SDK
    showLoading(statusEl, "Initializing FHEVM SDK");
    console.log("Loading TFHE WASM...");
    await initSDK();
    console.log("TFHE WASM loaded");

    // Create FHEVM instance
    showLoading(statusEl, "Creating FHEVM instance");
    const network = await provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);

    // Create config for Sepolia
    const config = {
      ...SepoliaConfig,
      network: window.ethereum,
    };

    console.log("Creating FHEVM instance with config:", config);
    fhevmInstance = await createInstance(config);
    console.log("FHEVM instance created:", fhevmInstance);

    showSuccess(statusEl, `Connected: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    networkStatusEl.textContent = `Network: ${network.name} (Chain ID: ${network.chainId})`;
  } catch (error) {
    console.error("Connection error:", error);
    showError(statusEl, `Connection failed: ${error.message}`);
  }
}

// Check Balance (using user decryption workflow from relayer SDK)
async function checkBalance() {
  const resultEl = document.getElementById("balanceResult");

  if (!checkConnection(resultEl)) return;

  try {
    const tokenAddress = document.getElementById("tokenAddress").value.trim();
    if (!ethers.isAddress(tokenAddress)) {
      showError(resultEl, "Invalid token address");
      return;
    }

    showLoading(resultEl, "Checking balance...");

    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);

    // Get token info
    let tokenInfo = "";
    try {
      const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      tokenInfo = `Token: ${name} (${symbol})\nDecimals: ${decimals}\n\n`;
    } catch (e) {
      tokenInfo = "Token info unavailable\n\n";
    }

    resultEl.textContent = tokenInfo;

    // Step 1: Get encrypted balance handle
    resultEl.textContent += "Step 1: Retrieving encrypted balance handle...\n";
    const encryptedBalance = await token.confidentialBalanceOf(userAddress);
    const ciphertextHandle = ethers.toBeHex(encryptedBalance, 32);
    resultEl.textContent += `Handle: ${ciphertextHandle}\n\n`;

    // Step 2: Generate keypair for decryption
    resultEl.textContent += "Step 2: Generating decryption keypair...\n";
    const { publicKey, privateKey } = fhevmInstance.generateKeypair();
    resultEl.textContent += "✓ Keypair generated\n\n";

    // Step 3: Get EIP-712 signature from user
    resultEl.textContent += "Step 3: Creating EIP-712 signature...\n";
    const eip712 = fhevmInstance.createEIP712(publicKey, tokenAddress);

    // Sign using MetaMask's eth_signTypedData_v4
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [userAddress, JSON.stringify(eip712)],
    });
    resultEl.textContent += "✓ Signature created\n\n";

    // Step 4: Decrypt the balance using user decryption
    resultEl.textContent += "Step 4: Decrypting balance...\n";
    const decryptedBalance = await fhevmInstance.reencrypt(
      ciphertextHandle,
      privateKey,
      publicKey,
      signature,
      tokenAddress,
      userAddress,
    );

    if (decryptedBalance !== undefined && decryptedBalance !== null) {
      resultEl.textContent += "\n✓ SUCCESS!\n";
      resultEl.textContent += "═══════════════════════════════\n";
      resultEl.textContent += `Balance: ${decryptedBalance.toString()}\n`;

      try {
        const decimals = await token.decimals();
        const formatted = Number(decryptedBalance.toString()) / Math.pow(10, Number(decimals));
        resultEl.textContent += `Formatted: ${formatted.toFixed(Number(decimals))} tokens\n`;
      } catch (e) {
        console.log("Could not format balance:", e);
      }

      resultEl.textContent += "═══════════════════════════════\n";
      resultEl.className = "result-box success";
    } else {
      showWarning(
        resultEl,
        tokenInfo + "Balance decryption returned no value. The balance might still be processing. Try again in a few seconds.",
      );
    }
  } catch (error) {
    console.error("Balance check error:", error);
    showError(resultEl, `Error: ${error.message}`);
  }
}

// Set Operator
async function setOperator() {
  const resultEl = document.getElementById("operatorResult");

  if (!checkConnection(resultEl)) return;

  try {
    const tokenAddress = document.getElementById("tokenAddress").value.trim();
    const until = document.getElementById("operatorUntil").value.trim();

    if (!ethers.isAddress(tokenAddress)) {
      showError(resultEl, "Invalid token address");
      return;
    }

    showLoading(resultEl, "Setting operator approval...");

    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);

    resultEl.textContent = `Approving batcher as operator...\n`;
    resultEl.textContent += `Batcher: ${BATCHER_ADDRESS}\n`;
    resultEl.textContent += `Valid until: ${until}\n\n`;

    const tx = await token.setOperator(BATCHER_ADDRESS, until);
    resultEl.textContent += `TX sent: ${tx.hash}\n`;
    resultEl.textContent += `Waiting for confirmation...\n`;

    const receipt = await tx.wait();
    resultEl.textContent += `\n✓ SUCCESS!\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.textContent += `Operator approved!\n`;
    resultEl.textContent += `Gas used: ${receipt.gasUsed.toString()}\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.className = "result-box success";
  } catch (error) {
    console.error("Set operator error:", error);
    showError(resultEl, `Error: ${error.message}`);
  }
}

// Batch Transfer (Same Amount) - using FHEVM v0.9 encryption
async function batchTransferSame() {
  const resultEl = document.getElementById("batchSameResult");

  if (!checkConnection(resultEl)) return;

  try {
    const tokenAddress = document.getElementById("tokenAddress").value.trim();
    const recipientsText = document.getElementById("recipientsSame").value.trim();
    const amount = document.getElementById("amountSame").value.trim();

    if (!ethers.isAddress(tokenAddress)) {
      showError(resultEl, "Invalid token address");
      return;
    }

    const recipients = recipientsText
      .split("\n")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (recipients.length === 0) {
      showError(resultEl, "No recipients provided");
      return;
    }

    for (const addr of recipients) {
      if (!ethers.isAddress(addr)) {
        showError(resultEl, `Invalid recipient address: ${addr}`);
        return;
      }
    }

    showLoading(resultEl, "Preparing batch transfer...");

    resultEl.textContent = `Batch Transfer (Same Amount)\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.textContent += `Recipients: ${recipients.length}\n`;
    resultEl.textContent += `Amount per recipient: ${amount}\n`;
    resultEl.textContent += `Total: ${BigInt(amount) * BigInt(recipients.length)}\n\n`;

    // Encrypt amount using FHEVM v0.9
    resultEl.textContent += "Step 1: Encrypting amount...\n";
    const encryptedInput = fhevmInstance.createEncryptedInput(BATCHER_ADDRESS, userAddress);
    encryptedInput.add64(BigInt(amount));
    const encryptedData = await encryptedInput.encrypt();

    console.log("Encrypted data:", encryptedData);

    // Extract handles and inputProof from the encrypted data
    const handles = encryptedData.handles || [];
    const inputProof = encryptedData.inputProof || "0x";

    console.log("Extracted handles:", handles);
    console.log("Extracted inputProof:", inputProof);

    if (!handles || handles.length === 0 || !handles[0]) {
      console.error("Encryption failed. Full encrypted data:", encryptedData);
      throw new Error("Encryption failed - no handle returned. Check console for details.");
    }

    resultEl.textContent += `Handle: ${handles[0]}\n\n`;

    // Send transaction
    resultEl.textContent += "Step 2: Sending batch transaction...\n";
    const batcher = new ethers.Contract(BATCHER_ADDRESS, BATCHER_ABI, signer);
    const tx = await batcher.batchSendTokenSameAmount(tokenAddress, recipients, handles[0], inputProof);
    resultEl.textContent += `TX sent: ${tx.hash}\n`;
    resultEl.textContent += `Waiting for confirmation...\n`;

    const receipt = await tx.wait();
    resultEl.textContent += `\n✓ SUCCESS!\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.textContent += `Batch transfer completed!\n`;
    resultEl.textContent += `Gas used: ${receipt.gasUsed.toString()}\n`;
    resultEl.textContent += `\nRecipient balances remain confidential.\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.className = "result-box success";
  } catch (error) {
    console.error("Batch transfer error:", error);
    showError(resultEl, `Error: ${error.message}`);
  }
}

// Batch Transfer (Different Amounts)
async function batchTransferDiff() {
  const resultEl = document.getElementById("batchDiffResult");

  if (!checkConnection(resultEl)) return;

  try {
    const tokenAddress = document.getElementById("tokenAddress").value.trim();
    const recipientsText = document.getElementById("recipientsDiff").value.trim();

    if (!ethers.isAddress(tokenAddress)) {
      showError(resultEl, "Invalid token address");
      return;
    }

    const lines = recipientsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      showError(resultEl, "No recipients provided");
      return;
    }

    const recipients = [];
    const amounts = [];
    let totalAmount = 0n;

    for (const line of lines) {
      const [addr, amt] = line.split(",").map((s) => s.trim());
      if (!addr || !amt) {
        showError(resultEl, `Invalid format in line: ${line}\nExpected: address,amount`);
        return;
      }
      if (!ethers.isAddress(addr)) {
        showError(resultEl, `Invalid address: ${addr}`);
        return;
      }
      recipients.push(addr);
      amounts.push(BigInt(amt));
      totalAmount += BigInt(amt);
    }

    showLoading(resultEl, "Preparing batch transfer...");

    resultEl.textContent = `Batch Transfer (Different Amounts)\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.textContent += `Recipients: ${recipients.length}\n`;
    resultEl.textContent += `Total amount: ${totalAmount}\n\n`;

    // Encrypt amounts using relayer SDK
    resultEl.textContent += "Step 1: Encrypting amounts...\n";
    const encryptedInput = fhevmInstance.createEncryptedInput(BATCHER_ADDRESS, userAddress);
    for (const amount of amounts) {
      encryptedInput.add64(amount);
    }

    // Await the encryption - it may return a Promise
    const encryptedData = await encryptedInput.encrypt();

    console.log("Encrypted data (diff amounts):", encryptedData);

    // Extract handles and inputProof from the encrypted data
    const handles = encryptedData.handles || [];
    const inputProof = encryptedData.inputProof || "0x";

    if (!handles || handles.length === 0) {
      console.error("Encryption failed. Full encrypted data:", encryptedData);
      throw new Error("Encryption failed - no handles returned");
    }

    resultEl.textContent += `Encrypted ${handles.length} amounts\n\n`;

    // Send transaction
    resultEl.textContent += "Step 2: Sending batch transaction...\n";
    const batcher = new ethers.Contract(BATCHER_ADDRESS, BATCHER_ABI, signer);
    const tx = await batcher.batchSendToken(tokenAddress, recipients, handles, inputProof);
    resultEl.textContent += `TX sent: ${tx.hash}\n`;
    resultEl.textContent += `Waiting for confirmation...\n`;

    const receipt = await tx.wait();
    resultEl.textContent += `\n✓ SUCCESS!\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.textContent += `Batch transfer completed!\n`;
    resultEl.textContent += `Gas used: ${receipt.gasUsed.toString()}\n`;
    resultEl.textContent += `\nRecipient balances remain confidential.\n`;
    resultEl.textContent += `═══════════════════════════════\n`;
    resultEl.className = "result-box success";
  } catch (error) {
    console.error("Batch transfer error:", error);
    showError(resultEl, `Error: ${error.message}`);
  }
}

// Helper functions
function checkConnection(resultEl) {
  if (!provider || !signer || !fhevmInstance) {
    showError(resultEl, "Please connect your wallet first");
    return false;
  }
  return true;
}

function showLoading(el, message) {
  el.textContent = message;
  el.className = "result-box loading";
}

function showSuccess(el, message) {
  el.textContent = message;
  el.className = "result-box success";
}

function showError(el, message) {
  el.textContent = "✗ " + message;
  el.className = "result-box error";
}

function showWarning(el, message) {
  el.textContent = "⚠ " + message;
  el.className = "result-box warning";
}

// Initialize app
init();
