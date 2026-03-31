# Get DEX token pair address

Get the pair address for a token0/token1 combination on a DEX, interchangeable order.

## Method

GET

## Base URL

`https://deep-index.moralis.io/api/v2.2`

## Path

`/:token0_address/:token1_address/pairAddress`

## Path Params

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| token0_address | string | Yes | The token0 address | \`YOUR_TOKEN_ADDRESS\` |
| token1_address | string | Yes | The token1 address | \`YOUR_TOKEN_ADDRESS\` |

## Query Params

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| chain | string (eth, 0x1, sepolia, 0xaa36a7, polygon, 0x89, bsc, 0x38, bsc testnet, 0x61, avalanche, 0xa86a, fantom, 0xfa, cronos, 0x19, arbitrum, 0xa4b1, chiliz, 0x15b38, chiliz testnet, 0x15b32, gnosis, 0x64, gnosis testnet, 0x27d8, base, 0x2105, base sepolia, 0x14a34, optimism, 0xa, polygon amoy, 0x13882, linea, 0xe708, moonbeam, 0x504, moonriver, 0x505, moonbase, 0x507, linea sepolia, 0xe705, flow, 0x2eb, flow-testnet, 0x221, ronin, 0x7e4, ronin-testnet, 0x31769, lisk, 0x46f, lisk-sepolia, 0x106a, pulse, 0x171, sei-testnet, 0x530, sei, 0x531, monad, 0x8f) | No | The chain to query | \`eth\` |
| to_block | string | No | The block number to get the reserves from | - |
| to_date | string | No | Get the reserves up to this date (format in seconds or datestring accepted by momentjs)
* Provide the param 'to_block' or 'to_date'
* If 'to_date' and 'to_block' are provided, 'to_block' will be used.
 | - |
| exchange | string | Yes | The factory name or address of the token exchange | \`uniswapv2\` |

## Response Example

Status: 200

Returns the pair address of the two tokens.

```json
{
  "token0": {
    "address": "YOUR_ADDRESS",
    "name": "HEX",
    "symbol": "HEX",
    "decimals": 9,
    "logo": "https://example.com/RESOURCE_URL",
    "logo_hash": "b3bd1b5512965d7b6aeee903dcc6d28b116d58c788eb41e9c1690baed878beaa",
    "thumbnail": "https://example.com/RESOURCE_URL",
    "block_number": 14836562,
    "validated": 0,
    "created_at": "2022-01-20T09:39:55.818Z"
  },
  "token1": {
    "address": "YOUR_ADDRESS",
    "name": "Tether USD",
    "symbol": "USDT",
    "decimals": 6,
    "logo": "https://example.com/RESOURCE_URL",
    "logo_hash": "ee7aa2cdf100649a3521a082116258e862e6971261a39b5cd4e4354fcccbc54d",
    "thumbnail": "https://example.com/RESOURCE_URL",
    "block_number": "4638568",
    "validated": 1,
    "created_at": "2022-01-20T09:39:55.818Z"
  },
  "pairAddress": "YOUR_PAIR_ADDRESS"
}
```

## Example (curl)

```bash
curl -X GET "https://deep-index.moralis.io/api/v2.2/YOUR_TOKEN_ADDRESS/YOUR_TOKEN_ADDRESS/pairAddress?chain=eth&exchange=uniswapv2" \
  -H "accept: application/json" \
  -H "X-API-Key: $MORALIS_API_KEY"
```
