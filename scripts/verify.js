const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("  Contract Verification on Unichain Sepolia");
  console.log("════════════════════════════════════════════════════════════════\n");

  // Load latest deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "unichain_testnet_latest.json");
  
  if (!fs.existsSync(latestFile)) {
    console.error("❌ No deployment file found. Please deploy first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  
  console.log("Loaded deployment:");
  console.log("  PlonkVerifier:", deployment.contracts.PlonkVerifier);
  console.log("  WrappedMonero:", deployment.contracts.WrappedMonero);
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Verify PlonkVerifier
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[1/2] Verifying PlonkVerifier...");
  try {
    await hre.run("verify:verify", {
      address: deployment.contracts.PlonkVerifier,
      constructorArguments: [],
    });
    console.log("✓ PlonkVerifier verified!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ PlonkVerifier already verified");
    } else {
      console.error("❌ Error verifying PlonkVerifier:", error.message);
    }
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // Verify WrappedMonero
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log("[2/2] Verifying WrappedMonero...");
  
  const constructorArgs = [
    deployment.contracts.PlonkVerifier,
    deployment.dependencies.wstETH,
    deployment.dependencies.pyth,
    3200000, // initialMoneroBlock
  ];

  console.log("Constructor arguments:");
  console.log("  verifier:", constructorArgs[0]);
  console.log("  wstETH:", constructorArgs[1]);
  console.log("  pyth:", constructorArgs[2]);
  console.log("  initialMoneroBlock:", constructorArgs[3]);
  console.log("");

  try {
    await hre.run("verify:verify", {
      address: deployment.contracts.WrappedMonero,
      constructorArguments: constructorArgs,
    });
    console.log("✓ WrappedMonero verified!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ WrappedMonero already verified");
    } else {
      console.error("❌ Error verifying WrappedMonero:", error.message);
    }
  }

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("✓ Verification Complete!");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("View on Uniscan:");
  console.log("  PlonkVerifier:");
  console.log("    https://sepolia.uniscan.xyz/address/" + deployment.contracts.PlonkVerifier);
  console.log("  WrappedMonero:");
  console.log("    https://sepolia.uniscan.xyz/address/" + deployment.contracts.WrappedMonero);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
