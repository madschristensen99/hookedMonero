require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Required for large contracts like the PLONK verifier
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    unichain_testnet: {
      url: process.env.UNICHAIN_RPC_URL || "https://sepolia.unichain.org",
      chainId: 1301,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      unichain_testnet: process.env.ETHERSCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "unichain_testnet",
        chainId: 1301,
        urls: {
          apiURL: "https://unichain-sepolia.blockscout.com/api",
          browserURL: "https://unichain-sepolia.blockscout.com"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};
