const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  Hooked Monero Deployment - Unichain Testnet");
  console.log("════════════════════════════════════════════════════════════════\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Unichain Testnet addresses
  const WSTETH_ADDRESS = process.env.WSTETH_ADDRESS || "0xc02fe7317d4eb8753a02c35fe019786854a92001";
  const PYTH_ADDRESS = process.env.PYTH_ADDRESS || "0x2880aB155794e7179c9eE2e38200202908C17B43";
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;

  console.log("Configuration:");
  console.log("  wstETH:", WSTETH_ADDRESS);
  console.log("  Pyth Oracle:", PYTH_ADDRESS);
  console.log("  Oracle Address:", ORACLE_ADDRESS);
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Step 1: Deploy PLONK Verifier
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[1/2] Deploying PLONK Verifier...");
  const PlonkVerifier = await hre.ethers.getContractFactory("PlonkVerifier");
  const verifier = await PlonkVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✓ PLONK Verifier deployed to:", verifierAddress);
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Step 2: Deploy WrappedMonero
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[2/2] Deploying WrappedMonero...");
  const WrappedMonero = await hre.ethers.getContractFactory("WrappedMonero");
  
  // Get initial Pyth price data (you'll need to provide this)
  // For now, we'll use placeholder values - in production, fetch from Pyth
  const xmrPriceData = {
    price: 15000000000n, // $150.00 (8 decimals)
    conf: 1000000n,
    expo: -8,
    publishTime: Math.floor(Date.now() / 1000)
  };
  
  const ethPriceData = {
    price: 250000000000n, // $2500.00 (8 decimals)
    conf: 10000000n,
    expo: -8,
    publishTime: Math.floor(Date.now() / 1000)
  };

  console.log("Initial prices:");
  console.log("  XMR/USD: $150.00");
  console.log("  ETH/USD: $2500.00");
  console.log("");

  const wrappedMonero = await WrappedMonero.deploy(
    verifierAddress,
    WSTETH_ADDRESS,
    PYTH_ADDRESS,
    ORACLE_ADDRESS,
    xmrPriceData,
    ethPriceData
  );
  
  await wrappedMonero.waitForDeployment();
  const wrappedMoneroAddress = await wrappedMonero.getAddress();
  console.log("✓ WrappedMonero deployed to:", wrappedMoneroAddress);
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Save Deployment Info
  // ══════════════════════════════════════════════════════════════════════════
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PlonkVerifier: verifierAddress,
      WrappedMonero: wrappedMoneroAddress,
    },
    dependencies: {
      wstETH: WSTETH_ADDRESS,
      pyth: PYTH_ADDRESS,
      oracle: ORACLE_ADDRESS,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${hre.network.name}_${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // Also save as latest
  const latestPath = path.join(deploymentsDir, `${hre.network.name}_latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("════════════════════════════════════════════════════════════════");
  console.log("✓ Deployment Complete!");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("Deployed Contracts:");
  console.log("  PlonkVerifier:", verifierAddress);
  console.log("  WrappedMonero:", wrappedMoneroAddress);
  console.log("");

  console.log("Deployment info saved to:");
  console.log(" ", filepath);
  console.log("");

  console.log("Next Steps:");
  console.log("  1. Verify contracts on block explorer");
  console.log("  2. Register as LP: wrappedMonero.registerLP(mintFeeBps, burnFeeBps)");
  console.log("  3. Deposit collateral: wrappedMonero.lpDeposit{value: ethAmount}()");
  console.log("  4. Update Pyth prices: wrappedMonero.updatePythPrice(priceUpdateData)");
  console.log("");

  console.log("Block Explorer:");
  console.log("  https://unichain-sepolia.blockscout.com/address/" + wrappedMoneroAddress);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
