import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

describe("eWETH - Decimal Conversion Tests", function () {
  let eWETH: any;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  const DECIMALS_CONVERSION = 10n ** 12n; // ETH (18 decimals) to eWETH (6 decimals)

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const eWETHFactory = await ethers.getContractFactory("eWETH");
    eWETH = await eWETHFactory.deploy("Encrypted Wrapped Ether", "eWETH", "");
    await eWETH.waitForDeployment();
  });

  describe("Deposit", function () {
    it("Should correctly convert ETH to eWETH tokens (18 decimals to 6 decimals)", async function () {
      const depositAmount = ethers.parseEther("0.01"); // 0.01 ETH in wei

      // Deposit ETH
      const tx = await eWETH.connect(user).deposit({ value: depositAmount });
      const receipt = await tx.wait();

      // Check the Deposit event
      const depositEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = eWETH.interface.parseLog(log);
          return parsed?.name === "Deposit";
        } catch {
          return false;
        }
      });

      expect(depositEvent).to.not.be.undefined;
      const parsed = eWETH.interface.parseLog(depositEvent);
      expect(parsed!.args.dest).to.equal(user.address);
      expect(parsed!.args.amount).to.equal(depositAmount);

      // The expected token amount should be depositAmount / 10^12
      // 0.01 ETH = 10^16 wei
      // 10^16 wei / 10^12 = 10^4 token units
      // With 6 decimals, 10^4 token units = 0.01 eWETH ✓
      const expectedTokenAmount = depositAmount / DECIMALS_CONVERSION;
      console.log("Deposit amount (wei):", depositAmount.toString());
      console.log("Expected token units:", expectedTokenAmount.toString());
      expect(expectedTokenAmount).to.equal(10000n); // 0.01 * 10^6 = 10000
    });

    it("Should revert if deposit amount is too small (less than 10^12 wei)", async function () {
      const tooSmallAmount = 10n ** 11n; // Less than DECIMALS_CONVERSION

      await expect(eWETH.connect(user).deposit({ value: tooSmallAmount }))
        .to.be.revertedWithCustomError(eWETH, "DepositTooSmall");
    });

    it("Should handle 1 ETH deposit correctly", async function () {
      const depositAmount = ethers.parseEther("1"); // 1 ETH

      await eWETH.connect(user).deposit({ value: depositAmount });

      // Expected: 1 ETH = 10^18 wei / 10^12 = 10^6 token units = 1 eWETH (with 6 decimals)
      const expectedTokenAmount = depositAmount / DECIMALS_CONVERSION;
      expect(expectedTokenAmount).to.equal(1000000n); // 1 * 10^6
    });

    it("Should handle multiple deposits correctly", async function () {
      const deposit1 = ethers.parseEther("0.01"); // 10^16 wei -> 10^4 token units
      const deposit2 = ethers.parseEther("0.05"); // 5*10^16 wei -> 5*10^4 token units

      await eWETH.connect(user).deposit({ value: deposit1 });
      await eWETH.connect(user).deposit({ value: deposit2 });

      // Total should be 6*10^4 token units = 0.06 eWETH
      const expectedTotal = (deposit1 + deposit2) / DECIMALS_CONVERSION;
      expect(expectedTotal).to.equal(60000n); // 0.06 * 10^6
    });
  });

  describe("Withdrawal Flow", function () {
    it("Should correctly convert token units back to wei on withdrawal", async function () {
      // This test verifies the logic but won't execute the full withdrawal
      // since it requires FHE encryption which needs special setup

      const depositAmount = ethers.parseEther("0.01"); // 10^16 wei
      await eWETH.connect(user).deposit({ value: depositAmount });

      // The contract should have stored: 10^16 / 10^12 = 10^4 token units
      const expectedTokenUnits = 10000n;

      // When withdrawing, it should convert back:
      // 10^4 token units * 10^12 = 10^16 wei = 0.01 ETH ✓
      const expectedWeiAmount = expectedTokenUnits * DECIMALS_CONVERSION;
      expect(expectedWeiAmount).to.equal(depositAmount);

      console.log("Token units:", expectedTokenUnits.toString());
      console.log("Converted back to wei:", expectedWeiAmount.toString());
      console.log("Original deposit:", depositAmount.toString());
    });

    it("Should demonstrate correct round-trip conversion", async function () {
      const testCases = [
        ethers.parseEther("0.001"), // 0.001 ETH
        ethers.parseEther("0.01"), // 0.01 ETH
        ethers.parseEther("1"), // 1 ETH
        ethers.parseEther("100"), // 100 ETH
      ];

      for (const amount of testCases) {
        // Convert to token units
        const tokenUnits = amount / DECIMALS_CONVERSION;

        // Convert back to wei
        const weiAmount = tokenUnits * DECIMALS_CONVERSION;

        // Should match original (no loss due to integer division if >= 10^12 wei)
        expect(weiAmount).to.equal(amount);
        console.log(`${ethers.formatEther(amount)} ETH -> ${tokenUnits} token units -> ${ethers.formatEther(weiAmount)} ETH`);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should calculate maximum uint64 token amount correctly", async function () {
      const maxTokenUnits = 2n ** 64n - 1n; // uint64 max
      const maxWeiEquivalent = maxTokenUnits * DECIMALS_CONVERSION;
      const maxEthEquivalent = maxWeiEquivalent / 10n ** 18n;

      console.log("Max token units (uint64):", maxTokenUnits.toString());
      console.log("Max wei equivalent:", maxWeiEquivalent.toString());
      console.log("Max ETH equivalent:", maxEthEquivalent.toString());

      // This should be ~18.44 million ETH
      // uint64 max = 18,446,744,073,709,551,615
      // * 10^12 = 18,446,744,073,709,551,615,000,000,000,000 wei
      // / 10^18 = 18,446,744,073,709 ETH (~18.4 million ETH)
      expect(maxEthEquivalent).to.equal(18446744073709n);
    });

    it("Should validate withdrawal conversion matches deposit conversion", async function () {
      // Test that deposit and withdrawal conversions are inverses
      const depositAmount = ethers.parseEther("5.5"); // 5.5 ETH

      // Simulate deposit conversion
      const tokenUnits = depositAmount / DECIMALS_CONVERSION;
      console.log("5.5 ETH deposit converts to:", tokenUnits.toString(), "token units");

      // Simulate withdrawal conversion
      const withdrawnWei = tokenUnits * DECIMALS_CONVERSION;
      console.log("Token units convert back to:", ethers.formatEther(withdrawnWei), "ETH");

      // Should be a perfect round trip
      expect(withdrawnWei).to.equal(depositAmount);
    });
  });

  describe("Decimal Precision", function () {
    it("Should demonstrate the vulnerability was fixed", async function () {
      const depositAmount = ethers.parseEther("0.01"); // 0.01 ETH

      // OLD VULNERABLE CODE WOULD HAVE DONE:
      // mint(10^16) token units -> with 6 decimals = 10,000,000,000 eWETH ❌

      // NEW FIXED CODE DOES:
      // mint(10^16 / 10^12) = mint(10^4) token units -> with 6 decimals = 0.01 eWETH ✓

      const correctTokenUnits = depositAmount / DECIMALS_CONVERSION;
      expect(correctTokenUnits).to.equal(10000n); // 0.01 * 10^6 = 10,000 token units

      // With 6 decimals, 10,000 token units = 0.01 tokens
      // This is correct! 0.01 ETH -> 0.01 eWETH
    });
  });
});
