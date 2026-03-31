# Get Metadata for NFTs

Get NFT metadata for one or many NFTs. Accepts an array of up to 25 `tokens`, each requiring `token_address` and `token_id`. Each NFT returned includes on-chain metadata as well as off-chain metadata, floor prices, rarity and more where available.

## Method

POST

## Base URL

`https://deep-index.moralis.io/api/v2.2`

## Path

`/nft/getMultipleNFTs`

## Query Params

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| chain | string (eth, 0x1, sepolia, 0xaa36a7, polygon, 0x89, bsc, 0x38, bsc testnet, 0x61, avalanche, 0xa86a, fantom, 0xfa, cronos, 0x19, arbitrum, 0xa4b1, chiliz, 0x15b38, chiliz testnet, 0x15b32, gnosis, 0x64, gnosis testnet, 0x27d8, base, 0x2105, base sepolia, 0x14a34, optimism, 0xa, polygon amoy, 0x13882, linea, 0xe708, moonbeam, 0x504, moonriver, 0x505, moonbase, 0x507, linea sepolia, 0xe705, flow, 0x2eb, flow-testnet, 0x221, ronin, 0x7e4, ronin-testnet, 0x31769, lisk, 0x46f, lisk-sepolia, 0x106a, pulse, 0x171, sei-testnet, 0x530, sei, 0x531, monad, 0x8f) | No | The chain to query | \`eth\` |

## Body

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| tokens | array | No | The tokens to be fetched (max 25 tokens) | \`[{"token_address":"YOUR_TOKEN_ADDRESS","token_id":"12"},{"token_address":"YOUR_TOKEN_ADDRESS","token_id":"1"},{"token_address":"YOUR_TOKEN_ADDRESS","token_id":"200"}]\` |
| normalizeMetadata | boolean | No | Should normalized metadata be returned? | \`false\` |
| media_items | boolean | No | Should preview media data be returned? | \`false\` |

## Response Example

Status: 200

Returns a collection of NFT owners

```json
[
  {
    "token_address": "YOUR_TOKEN_ADDRESS",
    "token_id": "15",
    "contract_type": "ERC721",
    "owner_of": "YOUR_ADDRESS",
    "block_number": "88256",
    "block_number_minted": "88256",
    "token_uri": "token_uri_example",
    "metadata": "metadata_example",
    "amount": "1",
    "name": "CryptoKitties",
    "symbol": "RARI",
    "token_hash": "502cee781b0fb40ea02508b21d319ced",
    "rarity_rank": 21669,
    "rarity_percentage": 98,
    "rarity_label": "Top 98%",
    "last_token_uri_sync": "2021-02-24T00:47:26.647Z",
    "last_metadata_sync": "2021-02-24T00:47:26.647Z",
    "possible_spam": "false",
    "verified_collection": "false",
    "floor_price": "12345",
    "floor_price_usd": "12345.4899",
    "floor_price_currency": "eth",
    "last_sale": {
      "transaction_hash": "YOUR_TX_HASH",
      "block_timestamp": "2023-04-04T15:59:11.000Z",
      "buyer_address": "YOUR_ADDRESS",
      "seller_address": "YOUR_ADDRESS",
      "price": "7300000000000000",
      "price_formatted": "0.0073",
      "usd_price_at_sale": "13.61",
      "current_usd_value": "15.53",
      "token_address": "YOUR_TOKEN_ADDRESS",
      "token_id": "170",
      "payment_token": {
        "token_name": "Ether",
        "token_symbol": "ETH",
        "token_logo": "https://cdn.moralis.io/eth/0x.png",
        "token_decimals": "18",
        "token_address": "YOUR_TOKEN_ADDRESS"
      }
    }
  }
]
```

## Example (curl)

```bash
curl -X POST "https://deep-index.moralis.io/api/v2.2/nft/getMultipleNFTs?chain=eth" \
  -H "accept: application/json" \
  -H "X-API-Key: $MORALIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  "tokens": [
    {
      "token_address": "YOUR_TOKEN_ADDRESS",
      "token_id": "12"
    },
    {
      "token_address": "YOUR_TOKEN_ADDRESS",
      "token_id": "1"
    },
    {
      "token_address": "YOUR_TOKEN_ADDRESS",
      "token_id": "200"
    }
  ],
  "normalizeMetadata": false,
  "media_items": false
}'
```
