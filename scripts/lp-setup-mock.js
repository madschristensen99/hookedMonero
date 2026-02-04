const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  LP Setup with Mock wstETH - Register, Deposit, Test Intent");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Load deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "unichain_testnet_mock_latest.json");
  
  if (!fs.existsSync(latestFile)) {
    console.error("❌ No mock deployment file found. Please deploy first:");
    console.error("   npm run deploy:mock");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const wrappedMoneroAddress = deployment.contracts.WrappedMonero;
  const mockWstETHAddress = deployment.contracts.MockWstETH;

  console.log("Contracts:");
  console.log("  WrappedMonero:", wrappedMoneroAddress);
  console.log("  MockWstETH:", mockWstETHAddress);
  console.log("");
  
  const [signer] = await hre.ethers.getSigners();
  console.log("LP Account:", signer.address);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Get contracts
  const WrappedMonero = await hre.ethers.getContractAt("WrappedMonero", wrappedMoneroAddress);
  const MockWstETH = await hre.ethers.getContractAt("MockWstETH", mockWstETHAddress);

  // ══════════════════════════════════════════════════════════════════════════
  // Step 1: Register as LP
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[1/4] Registering as LP...");
  
  const mintFeeBps = 50;  // 0.5%
  const burnFeeBps = 50;  // 0.5%
  const moneroAddress = "8BuPi2eetgmHxeqirYnrGMQYMTphDviL88ZkfJTACce95Ta48bmAwd9RKmai5nBA7rShtLadXcKwBT8PSjdyo5P4PgAPT23";
  const active = true;

  console.log("Configuration:");
  console.log("  Mint Fee:", mintFeeBps / 100, "%");
  console.log("  Burn Fee:", burnFeeBps / 100, "%");
  console.log("  Monero Address:", moneroAddress);
  console.log("");

  try {
    const tx = await WrappedMonero.registerLP(mintFeeBps, burnFeeBps, moneroAddress, active);
    console.log("  TX:", tx.hash);
    await tx.wait();
    console.log("✓ Registered as LP\n");
  } catch (error) {
    if (error.message.includes("already registered")) {
      console.log("⚠️  Already registered\n");
    } else {
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Step 2: Get wstETH from Mock
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[2/4] Getting wstETH from mock contract...");
  
  const wrapAmount = hre.ethers.parseEther("0.01"); // 0.01 ETH -> wstETH
  console.log("  Wrapping:", hre.ethers.formatEther(wrapAmount), "ETH");
  
  const wrapTx = await MockWstETH.deposit({ value: wrapAmount });
  console.log("  TX:", wrapTx.hash);
  const wrapReceipt = await wrapTx.wait();
  console.log("  Confirmed in block:", wrapReceipt.blockNumber);
  
  const wstETHBalance = await MockWstETH.balanceOf(signer.address);
  console.log("✓ Received:", hre.ethers.formatEther(wstETHBalance), "wstETH\n");

  // ══════════════════════════════════════════════════════════════════════════
  // Step 3: Approve and Deposit Collateral
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[3/4] Depositing wstETH collateral...");
  
  const depositAmount = hre.ethers.parseEther("0.005"); // 0.005 wstETH
  console.log("  Amount:", hre.ethers.formatEther(depositAmount), "wstETH");
  
  // Approve
  console.log("  Approving...");
  const approveTx = await MockWstETH.approve(wrappedMoneroAddress, depositAmount);
  await approveTx.wait();
  
  // Deposit
  console.log("  Depositing...");
  const depositTx = await WrappedMonero.lpDepositWstETH(depositAmount);
  console.log("  TX:", depositTx.hash);
  await depositTx.wait();
  console.log("✓ Collateral deposited\n");

  // Check LP info
  const lpInfo = await WrappedMonero.lpInfo(signer.address);
  console.log("LP Info:");
  console.log("  Collateral:", hre.ethers.formatEther(lpInfo.collateralAmount), "wstETH");
  console.log("  Backed Amount:", lpInfo.backedAmount.toString(), "XMR (piconero)");
  console.log("  Active:", lpInfo.active);
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Step 4: Create Test Mint Intent
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[4/4] Creating test mint intent...");
  
  // Calculate available capacity
  const collateralValueEth = lpInfo.collateralAmount; // 1:1 in mock
  const maxBackedValueEth = (collateralValueEth * 100n) / 150n; // SAFE_RATIO = 150
  
  console.log("  Collateral:", hre.ethers.formatEther(collateralValueEth), "wstETH");
  console.log("  Max backed value:", hre.ethers.formatEther(maxBackedValueEth), "ETH");
  
  // Create a small test intent (0.001 XMR = 1000000000 piconero)
  const expectedAmount = hre.ethers.parseUnits("0.001", 12); // 0.001 XMR
  const intentDeposit = hre.ethers.parseEther("0.001"); // 0.001 ETH anti-griefing deposit (MIN_INTENT_DEPOSIT)
  
  console.log("  Expected XMR amount:", hre.ethers.formatUnits(expectedAmount, 12), "XMR");
  console.log("  Intent deposit:", hre.ethers.formatEther(intentDeposit), "ETH");
  console.log("");

  try {
    const intentTx = await WrappedMonero.createMintIntent(
      signer.address, // LP address (using self for testing)
      expectedAmount,
      { value: intentDeposit }
    );
    console.log("  TX:", intentTx.hash);
    const receipt = await intentTx.wait();
    
    // Get intent ID from event
    const event = receipt.logs.find(log => {
      try {
        return WrappedMonero.interface.parseLog(log).name === "MintIntentCreated";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsed = WrappedMonero.interface.parseLog(event);
      const intentId = parsed.args.intentId;
      console.log("✓ Mint intent created!");
      console.log("  Intent ID:", intentId);
      console.log("");
      console.log("  User should now send", hre.ethers.formatUnits(expectedAmount, 12), "XMR to:");
      console.log("  ", moneroAddress);
    }
  } catch (error) {
    console.error("❌ Error creating intent:", error.message);
  }

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("✓ LP Setup Complete!");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("Summary:");
  console.log("  ✅ LP registered");
  console.log("  ✅ Collateral deposited:", hre.ethers.formatEther(lpInfo.collateralAmount), "wstETH");
  console.log("  ✅ Test mint intent created");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Users create mint intents");
  console.log("  2. Users send XMR to your Monero address");
  console.log("  3. Users generate ZK proofs");
  console.log("  4. Users submit proofs to mint zeroXMR");
  console.log("");
  console.log("View on Uniscan:");
  console.log("  https://sepolia.uniscan.xyz/address/" + wrappedMoneroAddress);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
