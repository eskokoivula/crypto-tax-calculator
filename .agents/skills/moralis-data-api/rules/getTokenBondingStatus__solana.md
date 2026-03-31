# Get Token Bonding Status

Get the token bonding status for a given network and contract (if relevant).

## Method

GET

## Base URL

`https://solana-gateway.moralis.io`

## Path

`/token/:network/:address/bonding-status`

## Path Params

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| network | string (mainnet) | Yes | The network to query | - |
| address | string | Yes | The address to query | \`YOUR_ADDRESS\` |

## Response Example

Status: default

```json
{
  "mint": "YOUR_SOLANA_MINT",
  "bondingProgress": 50,
  "graduatedAt": "2024-11-28T09:44:55.000Z"
}
```

## Example (curl)

```bash
curl -X GET "https://solana-gateway.moralis.io/token/mainnet/YOUR_ADDRESS/bonding-status" \
  -H "accept: application/json" \
  -H "X-API-Key: $MORALIS_API_KEY"
```
