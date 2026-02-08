# 🌉 Hooked Monero

**A privacy-preserving bridge bringing Monero to Ethereum using zero-knowledge proofs.**

Hooked Monero enables trustless, privacy-preserving bridging of Monero (XMR) to Ethereum and EVM chains. Users prove ownership of Monero transactions through PLONK zero-knowledge proofs without revealing sensitive transaction details on-chain.

## ✨ Key Features

### Core Technology
- **Zero-Knowledge Proofs**: PLONK proofs (~1,167 constraints) verify Monero transaction ownership
- **Browser-Based Proof Generation**: Full ZK proof generation in-browser using snarkjs
- **Cryptographic Amount Verification**: Decentralized amount decryption using LP private view keys
- **Merkle Proof Verification**: On-chain verification of transaction and output inclusion
- **Ed25519 & DLEQ Proofs**: Monero-compatible elliptic curve operations

### Privacy & Security
- **Transaction Public Key Verification**: Prevents unauthorized minting of others' Monero
- **Double-Spend Prevention**: On-chain tracking of used outputs
- **Collateralized Liquidity**: LPs provide wstETH collateral with 150% safe ratio
- **Yield-Bearing Backing**: Automatic staking rewards on LP collateral

### User Experience
- **Decentralized LP Network**: Multiple liquidity providers with competitive fees
- **Flexible Minting**: Support for mainnet addresses and subaddresses
- **Real-Time Oracle**: Monero blockchain data posted on-chain for verification
- **Web Interface**: Complete frontend for minting, burning, and LP management

## 🚀 Live Deployment

**Network**: Unichain Sepolia Testnet (Chain ID: 1301)  
**RPC**: https://sepolia.unichain.org

| Contract | Address |
|----------|----------|
| **WrappedMonero (wXMR)** | [`0xC67Cf54d14078ff2968b4Fcd55331C48CEf69eeF`](https://sepolia.uniscan.xyz/address/0xC67Cf54d14078ff2968b4Fcd55331C48CEf69eeF) |
| **PlonkVerifier** | [`0x7478d33f5542097f4e04dca0CA31835A5b35F9D8`](https://sepolia.uniscan.xyz/address/0x7478d33f5542097f4e04dca0CA31835A5b35F9D8) |

**Frontend**: [https://zeroxmr.com/hooked/index.html](https://zeroxmr.com/hooked/index.html)

**Example**: [Privately Funded Address](https://sepolia.uniscan.xyz/address/0x6E9f163085EDaF15584F13e9D156FE70b5AEb825#tokentxns) - Fresh address anonymously funded with wXMR

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
│   ├── deploy-relayer.js      # Deploy privacy relayer
│   ├── verify.js              # Contract verification
│   ├── verify-args.js         # Verification arguments
│   ├── relayer/               # Privacy relayer system
│   │   ├── signMintIntent.js  # EIP-712 intent signing
│   │   ├── relayerService.js  # Background relayer service
│   │   ├── privateMint.js     # User-facing private mint
│   │   ├── registerRelayer.js # Register as relayer
│   │   └── startRelayer.js    # Start relayer daemon
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

### Minting (Monero → Ethereum)

1. **Send Monero**: Transfer XMR to a liquidity provider's Monero address
2. **Generate Proof**: Browser generates ZK proof of transaction ownership
   - Proves knowledge of transaction secret key `r`
   - Verifies `R = r·G` matches transaction public key
   - Decrypts and verifies amount using LP's view key
   - Generates Merkle proofs for transaction and output inclusion
3. **Submit On-Chain**: Contract verifies all proofs and mints wrapped XMR
4. **Receive Tokens**: Get wXMR (ERC-20) in your Ethereum wallet

### Burning (Ethereum → Monero)

1. **Request Burn**: Submit burn request with destination Monero address
2. **Tokens Locked**: wXMR locked in contract
3. **LP Fulfills**: Liquidity provider sends XMR to your Monero address
4. **Completion**: Burn finalized after oracle confirmation

### For Liquidity Providers

1. **Register**: Set fees and provide Monero address + private view key
2. **Deposit Collateral**: Lock wstETH (minimum 150% collateralization)
3. **Earn Fees**: Collect fees from mints and burns
4. **Earn Yield**: Automatic staking rewards on wstETH collateral

## 🔐 Security

### Cryptographic Guarantees

- **PLONK Zero-Knowledge Proofs**: ~1,167 constraints verify transaction ownership
- **Transaction Public Key Matching**: Prevents minting of others' Monero
- **Ed25519 Operations**: Native Monero elliptic curve cryptography
- **DLEQ Proofs**: Discrete logarithm equality verification
- **Poseidon Commitments**: ZK-friendly binding of private inputs
- **Merkle Proofs**: Cryptographic proof of transaction inclusion

### Economic Security

**Collateralization Tiers:**
- **Safe Zone** (≥150%): LPs can accept new mints
- **Warning Zone** (120-150%): No new mints allowed
- **Liquidation** (<120%): Collateral can be claimed

**Oracle System:**
- Rust-based oracle posts Monero block data on-chain
- Merkle roots enable trustless verification
- Future: Decentralized oracle network

### Security Considerations

⚠️ **This is experimental software for research purposes.**

- Not audited by professional security firms
- Not recommended for production use with real funds
- Testnet deployment only
- Use at your own risk

## 📚 Documentation

### Project Documentation
- [Circuit Documentation](circuit/README.md) - Circom circuit implementation
- [Contract Documentation](contracts/README.md) - Solidity smart contracts

### External Resources
- [PLONK Paper](https://eprint.iacr.org/2019/953) - Zero-knowledge proof system
- [Monero Documentation](https://www.getmonero.org/resources/developer-guides/) - Monero cryptography
- [Circom Documentation](https://docs.circom.io/) - Circuit development
- [snarkjs](https://github.com/iden3/snarkjs) - ZK proof generation library

## 🧪 Testing

```bash
# Run contract tests
npm test

# Test circuit compilation
cd circuit && ./compile.sh

# Test proof generation
node scripts/proofGeneration/generate_proof_and_mint.js
```

## 🔮 Future Enhancements

- Decentralized oracle network for Monero block data
- Multi-chain deployment (Arbitrum, Optimism, Base)
- Advanced Monero features (ring signatures, stealth addresses)
- Professional security audit
- Mainnet deployment
- Enhanced LP routing and fee optimization

## 🤝 Contributing

Contributions welcome! This is experimental research software.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## ⚠️ Disclaimer

**EXPERIMENTAL RESEARCH SOFTWARE**

This software is provided "as is" for research and educational purposes only. It has not been audited and should not be used in production with real funds. The developers assume no liability for any losses incurred through the use of this software.

Before any production deployment, this system requires:
- Professional security audit by qualified firms
- Formal verification of critical components
- Extensive testing on testnets
- Legal and regulatory review
- Community review and feedback

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **GitHub**: [madschristensen99/hookedMonero](https://github.com/madschristensen99/hookedMonero)
- **Unichain Docs**: [docs.unichain.org](https://docs.unichain.org/)
- **Monero**: [getmonero.org](https://www.getmonero.org/)
- **Circom**: [docs.circom.io](https://docs.circom.io/)

---

Built with ❤️ for privacy and decentralization
