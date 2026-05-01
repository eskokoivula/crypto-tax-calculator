# Crypto Tax Calculator

A crypto tax calculator for Finnish investors. Pulls on-chain transactions via the Moralis API, imports exchange CSVs, and computes capital gains under Finnish tax rules (FIFO, EUR cost basis, 30 % / 34 % brackets).

## Project stage

**MVP — not under active development.**

Built as a working proof of concept. The core pipeline runs end-to-end (wallet → transactions → tax report), but the project is not feature-complete and is not maintained. Treat it as a portfolio piece, not production software.

### What works

- Connect EVM wallets (Ethereum, Polygon, BSC, etc.) and Solana addresses
- Fetch transaction history via Moralis Data API
- Import CSVs from common exchanges (parsers in `src/lib/exchange/parsers`)
- Auto-categorize transactions (buy / sell / swap / transfer)
- FIFO cost-basis matching in EUR using historical ECB rates
- Capital gains report with Finnish tax brackets (30 % up to €30k, 34 % above)
- Dashboard with chain breakdown, wallet breakdown, tax estimate
- Holdings, transactions and reports pages
- PDF / CSV export of the tax report
- AI chat assistant (Anthropic SDK) for questions about the data

### What's missing / rough

- No user accounts — state lives in the browser (Zustand)
- Limited exchange coverage; CSV parsers are best-effort
- DeFi positions (LP tokens, staking, lending) are not properly handled
- NFTs are mostly ignored
- No automated tests
- Edge cases in transaction deduplication and categorisation are not all covered
- UI polish is partial

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** + **Base UI**
- **Zustand** for client state
- **Moralis Web3 Data API** for on-chain data
- **Anthropic SDK** (Claude) for the chat assistant
- **jsPDF** + **PapaParse** for export / CSV parsing

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in API keys
npm run dev
```

Required environment variables:

```
MORALIS_API_KEY=...
ANTHROPIC_API_KEY=...
```

Open <http://localhost:3000>.

## Project structure

```
src/
  app/            Next.js routes (dashboard, holdings, transactions, reports) + API routes
  components/     UI by feature (dashboard, wallet, chat, exchange, holdings, ...)
  lib/
    moralis/      Moralis API client and helpers
    exchange/     CSV parsers per exchange
    tax/          FIFO matching, gains calc, categorisation, dedup
    ai/           Chat / agent helpers
    export/       PDF / CSV export
    pipeline.ts   Wallet → transactions → tax pipeline
  store/          Zustand stores
  hooks/, types/  Shared hooks and types
```

## Disclaimer

Not tax advice. Output has not been validated against real Vero filings. Use at your own risk and verify numbers with a real accountant before filing anything.

## License

MIT
