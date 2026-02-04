# 🌉 Hooked Monero

> **🎉 MVP SUCCESS!** First successful mint completed Feb 4, 2026  
> Transaction: [View on Uniscan](https://sepolia.uniscan.xyz/tx/0x3bb99d293c6127323ed500193989acdd412fa4c0714bb517ac6ff7cf5fcf1e13)

A privacy-preserving bridge for Monero (XMR) to Ethereum using zero-knowledge proofs (PLONK).

## 🎯 Overview

**Hooked Monero** enables trustless bridging of Monero to Ethereum while preserving transaction privacy through zero-knowledge proofs. Users can prove ownership of Monero transactions and decrypt amounts without revealing sensitive cryptographic details on-chain.

### Key Features

- ✅ **End-to-End Minting**: Full flow from Monero TX → ZK proof → Token mint working!
- ✅ **Privacy-Preserving**: ZK proofs verify Monero ownership without revealing transaction details
- ✅ **LP-Based Model**: Decentralized liquidity providers back wrapped tokens
- ✅ **Yield-Bearing Collateral**: LPs use wstETH for automatic yield generation
- ✅ **PLONK Proofs**: Efficient ZK-SNARKs with ~1,167 constraints
- ⚠️ **In Progress**: Merkle proof verification, full ZK verification (temporarily disabled for MVP)
- ⚠️ **In Progress**: Pyth Network oracle integration for XMR/ETH prices

## 🚀 Deployed Contracts (Unichain Sepolia Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **WrappedMonero (zeroXMR)** | `0x956d362086076b05Cf90CBf2EF30689b1172c9C5` | [View on Uniscan](https://sepolia.uniscan.xyz/address/0x956d362086076b05Cf90CBf2EF30689b1172c9C5) |
| **PlonkVerifier** | `0x1ed5BfabBd944e5417Eab5c3C1A64173C5eDa93F` | [View on Uniscan](https://sepolia.uniscan.xyz/address/0x1ed5BfabBd944e5417Eab5c3C1A64173C5eDa93F) |
| **First Mint TX** | - | [View on Uniscan](https://sepolia.uniscan.xyz/tx/0x3bb99d293c6127323ed500193989acdd412fa4c0714bb517ac6ff7cf5fcf1e13) |

**Network**: Unichain Sepolia (Chain ID: 1301)  
**RPC**: https://sepolia.unichain.org

## 📁 Project Structure

```
hookedMonero/
├── circuit/                    # Circom ZK circuit
│   ├── monero_bridge.circom   # Main circuit (PLONK)
│   ├── compile.sh             # Circuit compilation script
│   ├── build/                 # Generated circuit artifacts (gitignored)
│   └── README.md              # Circuit documentation
│
├── contracts/                  # Solidity smart contracts
│   ├── WrappedMonero.sol      # Main bridge contract
│   ├── MoneroBridgeVerifier.sol # PLONK verifier (auto-generated)
│   ├── interfaces/            # Contract interfaces
│   ├── libraries/             # Ed25519 & utilities
│   └── README.md              # Contract documentation
│
├── scripts/                    # Deployment & management scripts
│   ├── deploy.js              # Main deployment script
│   ├── verify.js              # Contract verification
│   ├── verify-args.js         # Verification arguments
│   └── oracle/                # Oracle management scripts
│       ├── setup.sh           # Configure oracle
│       └── run.sh             # Run oracle service
│
├── deployments/                # Deployment records (gitignored except latest)
│   └── unichain_testnet_latest.json
│
├── hardhat.config.js          # Hardhat configuration
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Monero    │         │   Ethereum   │         │   Unichain  │
│  Mainnet    │         │   Mainnet    │         │   Sepolia   │
└──────┬──────┘         └──────────────┘         └──────┬──────┘
       │                                                 │
       │  1. User sends XMR                             │
       │     to LP's address                            │
       │                                                 │
       │  2. Generate ZK proof                          │
       │     of ownership                               │
       │                                                 │
       └─────────────────────────────────────────────────┤
                                                         │
                                                         │  3. Submit proof
                                                         │     & mint zeroXMR
                                                         │
                                                    ┌────▼─────┐
                                                    │ Wrapped  │
                                                    │  Monero  │
                                                    │ Contract │
                                                    └──────────┘
```

### Components

1. **Circom Circuit** (`circuit/`)
   - Proves knowledge of Monero transaction private key
   - Verifies ECDH amount decryption
   - Validates Poseidon commitment
   - Generates PLONK proofs (~1,167 constraints)

2. **Smart Contracts** (`contracts/`)
   - **WrappedMonero**: Main bridge logic, LP management, minting/burning
   - **PlonkVerifier**: On-chain ZK proof verification
   - **Ed25519 Library**: Monero cryptography verification

3. **Deployment Scripts** (`scripts/`)
   - Automated deployment to Unichain
   - Pyth price oracle integration
   - Contract verification on Uniscan

## 🛠️ Development Setup

### Prerequisites

- Node.js v16+
- npm or yarn
- Circom 2.1.0+
- snarkjs

### Installation

```bash
# Clone the repository
git clone https://github.com/madschristensen99/hookedMonero.git
cd hookedMonero

# Install dependencies
npm install

# Install circuit dependencies
cd circuit
npm install
cd ..
```

### Compile Circuit

```bash
cd circuit
./compile.sh
```

This will:
- Compile the Circom circuit
- Generate PLONK proving/verification keys
- Create Solidity verifier contract
- Copy verifier to `contracts/`

### Compile Contracts

```bash
npm run compile
```

### Deploy to Unichain Testnet

1. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

2. Get testnet ETH from [Unichain Faucet](https://faucet.unichain.org/)

3. Deploy:
```bash
npm run deploy:unichain
```

4. Verify contracts:
```bash
npm run verify
```

## 📖 How It Works

### For Liquidity Providers (LPs)

1. **Register**: Set mint/burn fees and activate LP status
2. **Deposit Collateral**: Deposit ETH (converted to wstETH)
3. **Earn Fees**: Receive fees from mints/burns
4. **Earn Yield**: wstETH collateral generates staking rewards

### For Users

#### Minting zeroXMR

1. Create mint intent with anti-griefing deposit
2. Send XMR to LP's Monero address
3. Generate ZK proof of transaction ownership
4. Submit proof to contract → receive zeroXMR

#### Burning zeroXMR

1. Request burn with XMR destination address
2. zeroXMR tokens locked in contract
3. LP sends XMR within 2 hours
4. Oracle confirms → burn complete
5. If LP fails → claim LP collateral

## 🔐 Security

### Cryptographic Components

- **ZK Proofs**: PLONK with ~1,167 constraints
- **Ed25519**: Monero's elliptic curve cryptography
- **DLEQ Proofs**: Discrete log equality proofs
- **Poseidon Hash**: ZK-friendly commitment scheme

### Collateralization

- **Safe Ratio**: 150% (LPs can accept mints)
- **Risk Zone**: 120-150% (no new mints)
- **Liquidation**: <120% (anyone can liquidate)

### Oracle Trust

- **Pyth Network**: Decentralized price feeds
- **Transaction Oracle**: Confirms Monero transactions (can be decentralized)

⚠️ **WARNING**: This is experimental software. NOT audited for production use.

## 📚 Documentation

- [Circuit Documentation](circuit/README.md) - Circom circuit details
- [Contract Documentation](contracts/README.md) - Solidity contract details
- [Pyth Network Docs](https://docs.pyth.network/) - Oracle integration
- [PLONK Paper](https://eprint.iacr.org/2019/953) - ZK proof system

## 🧪 Testing

```bash
# Run contract tests
npm test

# Test Pyth oracle integration
npx hardhat run scripts/test-pyth.js --network unichain_testnet
```

## 🚧 Roadmap

- [ ] Mainnet deployment
- [ ] Decentralized oracle network
- [ ] Multi-LP support with routing
- [ ] Subaddress support
- [ ] Ring signature verification
- [ ] Security audit
- [ ] Frontend dApp
- [ ] Cross-chain support (other L2s)

## 🤝 Contributing

Contributions welcome! This is experimental research software.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## ⚠️ Disclaimer

**EXPERIMENTAL SOFTWARE - NOT AUDITED**

This software is provided "as is" without warranty of any kind. Do not use with real funds without:
- Professional security audit
- Formal verification
- Extensive testing
- Legal review

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **Testnet Deployment**: [Uniscan](https://sepolia.uniscan.xyz/address/0xCE92E887d225D06c21a16d845D88E980d536FA2b)
- **GitHub**: [madschristensen99/hookedMonero](https://github.com/madschristensen99/hookedMonero)
- **Unichain**: [docs.unichain.org](https://docs.unichain.org/)
- **Pyth Network**: [pyth.network](https://pyth.network/)

---

Built with ❤️ for privacy and decentralization
