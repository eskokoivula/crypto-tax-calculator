# ENS lookup by address

Convert an Ethereum address to its associated ENS domain, if registered.

## Method

GET

## Base URL

`https://deep-index.moralis.io/api/v2.2`

## Path

`/resolve/:address/reverse`

## Path Params

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|----------|
| address | string | Yes | The address to be resolved | \`YOUR_ADDRESS\` |

## Response Example

Status: 200

Returns an ENS

```json
{
  "name": "Vitalik.eth"
}
```

## Example (curl)

```bash
curl -X GET "https://deep-index.moralis.io/api/v2.2/resolve/YOUR_ADDRESS/reverse" \
  -H "accept: application/json" \
  -H "X-API-Key: $MORALIS_API_KEY"
```
