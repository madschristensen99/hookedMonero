# 🔐 Privacy-Preserving Relayer System for Hooked Monero

## Overview

The MintRelayer system adds **privacy** to Hooked Monero by breaking the on-chain link between the user who sends XMR and the address that receives wXMR. This is achieved using an **ERC-4337 style relayer architecture** where users sign mint intents off-chain, and relayers execute them on-chain.

## Privacy Benefits

### Without Relayer (Direct Mint)
```
User Address → Calls mint() → Receives wXMR
❌ On-chain link visible
❌ User pays gas (reveals address)
❌ Blockchain analysis can track user
```

### With Relayer (Private Mint)
```
User → Signs Intent → Relayer → Executes mint → Fresh Address receives wXMR
✅ No on-chain link between user and fresh address
✅ Relayer pays gas (user address hidden)
✅ Fresh address can be used once and discarded
✅ Monero privacy + Ethereum privacy
```

## Architecture

### Components

1. **MintRelayer.sol** - Smart contract that verifies signatures and executes mints
2. **signMintIntent.js** - Helper library for creating and signing intents
3. **relayerService.js** - Background service that monitors and executes intents
4. **privateMint.js** - User-facing script for creating private mint intents

### Flow Diagram

```
┌─────────────┐
│   User      │
│ (Off-chain) │
└──────┬──────┘
       │
       │ 1. Send XMR to LP's Monero address
       │ 2. Generate ZK proof
       │ 3. Create fresh Ethereum address
       │ 4. Sign MintIntent with EIP-712
       │
       ▼
┌─────────────────┐
│  Intent Queue   │
│  (JSON file or  │
│   API service)  │
└────────┬────────┘
         │
         │ 5. Relayer monitors queue
         │
         ▼
┌──────────────────┐
│  Relayer Service │
│   (Background)   │
└────────┬─────────┘
         │
         │ 6. Verify signature
         │ 7. Execute relayMint()
         │
         ▼
┌──────────────────┐
│  MintRelayer.sol │
│   (On-chain)     │
└────────┬─────────┘
         │
         │ 8. Verify ZK proof
         │ 9. Mint wXMR
         │ 10. Transfer to fresh address
         │
         ▼
┌──────────────────┐
│  Fresh Address   │
│  (Receives wXMR) │
└──────────────────┘
```

## Setup

### 1. Deploy Contracts

```bash
# Deploy WrappedMonero (if not already deployed)
npx hardhat run scripts/deploy.js --network localhost

# Deploy MintRelayer
npx hardhat run scripts/deploy-relayer.js --network localhost
```

### 2. Register as a Relayer

```bash
npx hardhat run scripts/relayer/registerRelayer.js --network localhost
```

This will:
- Stake ETH (default: 0.1 ETH)
- Register your address as an authorized relayer
- Allow you to execute mint intents

### 3. Start Relayer Service

```bash
npx hardhat run scripts/relayer/startRelayer.js --network localhost
```

The relayer will:
- Monitor `relayer-queue.json` for new intents
- Process pending intents every 10 seconds
- Execute mints and collect fees
- Update intent status (pending → completed/failed)

## Usage

### For Users: Creating a Private Mint Intent

```javascript
const { createPrivateMintIntent } = require("./scripts/relayer/signMintIntent");

// Create intent with fresh recipient address
const { freshAddress, intent, signature } = await createPrivateMintIntent(
    {
        signer: userAddress,      // Your current address
        lp: lpAddress,            // LP to use
        expectedAmount: "1000000000000"  // 1 XMR in piconero
    },
    relayerAddress,
    userWallet
);

// Save fresh address private key securely!
console.log("Fresh address:", freshAddress.address);
console.log("Private key:", freshAddress.privateKey);

// Submit intent to relayer (via API or queue file)
// ... add to queue with proof data ...
```

### For Relayers: Processing Intents

The relayer service automatically processes intents from the queue. You can also manually process:

```javascript
const RelayerService = require("./scripts/relayer/relayerService");

const service = new RelayerService({
    relayerAddress,
    wrappedMoneroAddress,
    relayerWallet,
    intentQueueFile: "./relayer-queue.json"
});

await service.init();
await service.processQueue();
```

## Intent Structure

### MintIntent

```solidity
struct MintIntent {
    address signer;           // Original user who sent XMR
    address recipient;        // Fresh address to receive wXMR
    address lp;              // LP to use for minting
    uint256 expectedAmount;  // Expected wXMR amount (in piconero)
    uint256 nonce;           // Replay protection
    uint256 deadline;        // Intent expiry timestamp
    uint256 maxRelayerFee;   // Max fee user willing to pay (in piconero)
}
```

### EIP-712 Signature

Intents are signed using EIP-712 typed data:

```javascript
const domain = {
    name: "HookedMoneroMintRelayer",
    version: "1",
    chainId: chainId,
    verifyingContract: relayerAddress
};

const types = {
    MintIntent: [
        { name: "signer", type: "address" },
        { name: "recipient", type: "address" },
        { name: "lp", type: "address" },
        { name: "expectedAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "maxRelayerFee", type: "uint256" }
    ]
};

const signature = await wallet.signTypedData(domain, types, intent);
```

## Fees

### LP Fee
- Set by LP (e.g., 0.5% = 50 bps)
- Deducted from minted amount
- Goes to LP

### Relayer Fee
- Set by MintRelayer contract (default: 0.1% = 10 bps)
- Deducted from amount after LP fee
- Goes to relayer for gas costs
- Max: 1% (100 bps)

### Example
```
User sends: 1.0 XMR
LP fee (0.5%): 0.005 XMR → LP
After LP fee: 0.995 XMR
Relayer fee (0.1%): 0.000995 XMR → Relayer
User receives: 0.994005 XMR → Fresh Address
```

## Security Features

### 1. Signature Verification
- EIP-712 typed data signatures
- Prevents signature replay attacks
- Nonce-based replay protection

### 2. Intent Expiry
- Maximum 1 hour between signing and execution
- Prevents stale intents from being executed
- User can set custom deadline

### 3. Relayer Staking
- Relayers must stake ETH to participate
- Minimum stake: 0.1 ETH (configurable)
- Prevents spam and Sybil attacks

### 4. Permissioned/Permissionless Modes
- **Permissioned**: Only authorized relayers can execute
- **Permissionless**: Anyone with sufficient stake can relay
- Owner can toggle mode

### 5. Fee Limits
- User sets `maxRelayerFee` in intent
- Transaction reverts if relayer fee exceeds limit
- Protects users from excessive fees

## Configuration

### Contract Parameters

```solidity
// Relayer fee (basis points)
uint256 public relayerFeeBps = 10;  // 0.1%
uint256 public constant MAX_RELAYER_FEE_BPS = 100;  // Max 1%

// Minimum relayer stake
uint256 public minRelayerStake = 0.1 ether;

// Intent expiry
uint256 public constant MAX_INTENT_AGE = 1 hours;
```

### Update Configuration (Owner Only)

```javascript
// Update relayer fee
await mintRelayer.setRelayerFee(20);  // 0.2%

// Update minimum stake
await mintRelayer.setMinRelayerStake(ethers.parseEther("0.5"));

// Toggle permissionless mode
await mintRelayer.togglePermissionlessMode();
```

## Production Deployment

### 1. API Service (Recommended)

Instead of a JSON file queue, deploy an API service:

```
POST /api/intents
{
    "intent": { ... },
    "signature": "0x...",
    "proofData": { ... }
}

GET /api/intents/:id
{
    "status": "pending|completed|failed",
    "txHash": "0x...",
    ...
}
```

### 2. Decentralized Relayer Network

- Multiple relayers compete for intents
- First relayer to execute gets the fee
- Redundancy and censorship resistance

### 3. Privacy Enhancements

- **Tor/VPN**: Users submit intents via Tor
- **Mixers**: Fresh addresses can use Tornado Cash or similar
- **Batching**: Relayer batches multiple mints for additional privacy
- **Delayed Execution**: Random delay before execution

### 4. Monitoring

```javascript
// Monitor relayer performance
const status = relayerService.getStatus();
console.log(`Completed: ${status.completed}`);
console.log(`Failed: ${status.failed}`);

// Alert on failures
if (status.failed > threshold) {
    sendAlert("High failure rate!");
}
```

## Testing

### Run Full Flow

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/deploy-relayer.js --network localhost

# Terminal 3: Register and start relayer
npx hardhat run scripts/relayer/registerRelayer.js --network localhost
npx hardhat run scripts/relayer/startRelayer.js --network localhost

# Terminal 4: Create private mint intent
npx hardhat run scripts/relayer/privateMint.js --network localhost
```

### Unit Tests

```bash
npx hardhat test test/MintRelayer.test.js
```

## Troubleshooting

### "Not authorized relayer"
- Register as relayer: `npx hardhat run scripts/relayer/registerRelayer.js`
- Check stake: Must be >= `minRelayerStake`

### "Invalid signature"
- Verify nonce is correct
- Check EIP-712 domain separator matches
- Ensure signer address matches intent.signer

### "Intent expired"
- Deadline must be in the future
- Maximum 1 hour from signing to execution
- Create new intent with updated deadline

### "Relayer fee too high"
- Increase `maxRelayerFee` in intent
- Or wait for relayer to lower fees

## Future Enhancements

1. **ZK-SNARKs for Intent Privacy**: Hide intent details on-chain
2. **Cross-chain Relaying**: Support multiple EVM chains
3. **Automated Market Making**: Dynamic relayer fees based on demand
4. **Reputation System**: Track relayer performance
5. **Gasless Transactions**: Meta-transactions for even more privacy

## Resources

- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-712: Typed Data Signing](https://eips.ethereum.org/EIPS/eip-712)
- [Monero Privacy](https://www.getmonero.org/resources/moneropedia/)

## Support

For issues or questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Discord: [Join our server](#)
- Email: support@hookedmonero.com

---

**⚠️ Security Notice**: This is experimental software. Always test thoroughly before using in production. Never share your private keys or fresh address private keys insecurely.
