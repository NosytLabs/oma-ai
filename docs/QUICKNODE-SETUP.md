# QuickNode Setup for OMA-AI

QuickNode provides the RPC endpoints for OMA-AI's Base mainnet and Base Sepolia testnet.

## Free Tier

QuickNode offers a free tier with:
- 50M credits/month
- 50 requests/second
- Base mainnet + testnet support

## Setup

1. Sign up at https://www.quicknode.com/
2. Create a new endpoint
3. Select "Base" as the chain
4. Copy the HTTP endpoint URL
5. Set in your .env:
   ```
   NEXT_PUBLIC_QUICKNODE_MAINNET_URL=https://your-endpoint.base.quiknode.pro/your-token/
   NEXT_PUBLIC_QUICKNODE_TESTNET_URL=https://your-endpoint.base-sepolia.quiknode.pro/your-token/
   ```

## Verification

Test with:
```bash
curl -X POST $NEXT_PUBLIC_QUICKNODE_MAINNET_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Cost Optimization

- Use HTTP polling instead of WebSocket where possible
- Batch multiple `eth_call` requests via `eth_multicall`
- Cache `eth_chainId` (it's constant)
- Use `eth_getLogs` with block ranges, not per-block
