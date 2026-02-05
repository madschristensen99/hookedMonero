# Merkle Proof Verification Bug

## Status: KNOWN ISSUE

## Problem
TX Merkle proof verification fails even though:
- ✅ JavaScript Merkle root computation is correct
- ✅ Manual proof verification works in JavaScript  
- ✅ Proof computation logic is correct
- ❌ Oracle posts DIFFERENT Merkle root than JavaScript computes
- ❌ Contract verification fails

## Root Cause
The oracle and JavaScript are computing DIFFERENT Merkle roots for the same block.

### Example (Block 3603511):
- **JavaScript computed root:** `0x433ecd5ba23b53cc11a25819f33f013660a95f2158bf8b23e0f9f83eaa77a41f`
- **Oracle posted root:** `0x0511a4cda787b64fec5076aa8c8f702d4f63403117ca8a986f3dc55a12c4d5bc`

## Investigation
1. Both use keccak256 for hashing
2. Both use the same tree structure (binary Merkle tree)
3. Both duplicate the last hash for odd numbers
4. **BUT**: They produce different roots!

## Possible Causes
1. **Different RPC endpoints** - Oracle might use different Monero RPC that returns data in different format
2. **Different transaction ordering** - Oracle might include/exclude miner TX differently
3. **Parameter scrambling** - Memory mentions "Oracle parameter scrambling found and working"
4. **Hash encoding** - Possible difference in how transaction hashes are encoded before hashing

## Workaround
TX Merkle verification is temporarily disabled in the contract:
```solidity
// TODO: BUG - verifyTxInBlock returns false even though manual verification passes
// require(
//     verifyTxInBlock(output.txHash, blockHeight, txMerkleProof, txIndex),
//     "TX not in block"
// );
```

## Next Steps
1. Compare oracle's Merkle computation code with JavaScript implementation
2. Check if oracle includes miner TX in the tree
3. Verify both use same transaction hash format (with/without 0x prefix)
4. Test with same RPC endpoint
5. Add debug logging to oracle to see exact hashes being used

## Files Involved
- `/home/remsee/hookedMonero/contracts/WrappedMonero.sol` - Contract with disabled verification
- `/home/remsee/hookedMonero/scripts/utils/compute_merkle_proof.js` - JavaScript Merkle computation
- `/home/remsee/hookedMonero/monero-oracle/src/main.rs` - Oracle Merkle computation

## Test Scripts
- `test_merkle_debug.js` - Manual verification in JavaScript (WORKS)
- `test_contract_merkle.js` - Contract verification test (FAILS)
- `test_proof_3603507.js` - Specific block test
- `test_direct_call.js` - Direct contract call test

## Impact
- ⚠️ Minting works WITHOUT Merkle verification
- ⚠️ Security reduced - cannot verify TX actually exists in posted block
- ✅ Other proofs (ZK, Ed25519, DLEQ) still work
- ✅ Block existence is still verified
