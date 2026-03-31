# Crypto Tax DApp — Design Spec

**Date:** 2026-03-31
**Target:** Finnish tax reporting (Vero) for crypto assets
**Currency:** All values in EUR
**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui

---

## 1. Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js App Router)              │
│  ├─ Dashboard page (summary cards)          │
│  ├─ Transactions page (timeline + filters)  │
│  ├─ Holdings page (current portfolio)       │
│  ├─ Reports page (PDF/CSV/Lomake 9 export)  │
│  ├─ AI Chat drawer (slide-over, right side) │
│  └─ Exchange Import modal                   │
├─────────────────────────────────────────────┤
│  API Routes (Next.js /api)                  │
│  ├─ /api/wallets/[address]/chains           │
│  ├─ /api/wallets/[address]/history          │
│  ├─ /api/wallets/[address]/profitability    │
│  ├─ /api/wallets/[address]/balances         │
│  ├─ /api/aggregate (multi-wallet summary)   │
│  ├─ /api/chat (Claude API proxy)            │
│  ├─ /api/import (exchange CSV parser)       │
│  └─ /api/export (PDF/CSV/Lomake 9)         │
├─────────────────────────────────────────────┤
│  External APIs                              │
│  ├─ Moralis Data API (blockchain data)      │
│  ├─ Claude API (AI report modifications)    │
│  └─ ECB exchange rates (USD→EUR)            │
└─────────────────────────────────────────────┘
```

**Key decisions:**
- No database — all data fetched on-demand from Moralis, cached client-side in React state
- All Moralis endpoints return USD — converted server-side using ECB daily reference rates
- For historical transactions, EUR conversion uses the ECB rate from the transaction date
- Claude API called server-side only (key stays on backend)
- Exchange CSV imports parsed client-side, merged into the unified transaction model

---

## 2. Moralis API Endpoints Used

| Endpoint | Purpose | Chains |
|----------|---------|--------|
| `getWalletActiveChains` | Auto-detect active chains per wallet | All EVM |
| `getWalletHistory` | Complete decoded transaction history | All EVM |
| `getWalletProfitability` | Realized/unrealized gains per token | ETH, Polygon, Base |
| `getWalletProfitabilitySummary` | Aggregated P&L summary | ETH, Polygon, Base |
| `getWalletTokenBalancesPrice` | Current holdings with USD prices | All EVM |
| `getWalletNetWorth` | Total portfolio value | All EVM |
| `getWalletTokenTransfers` | ERC20 transfer details | All EVM |

**Supported chains:**
- Full profitability support: Ethereum (0x1), Polygon (0x89), Base (0x2105)
- History + balances only: BNB Chain (0x38), Arbitrum (0xa4b1), Optimism (0xa), Avalanche (0xa86a)

---

## 3. Data Flow

### 3.1 Multi-Wallet Ingestion

1. User adds up to 10 wallet addresses in the sidebar
2. For each wallet → `getWalletActiveChains` to auto-detect chains
3. For each wallet+chain combo → parallel fetch:
   - `getWalletHistory` (paginated, cursor-based)
   - `getWalletProfitability` (where supported)
   - `getWalletTokenBalancesPrice`
4. All data merged into a unified `Transaction[]` array
5. Exchange CSV imports merged into the same array with `source: "exchange"` tag

### 3.2 Transaction Deduplication

- Compare `from_address` and `to_address` against all user wallet addresses
- If both sender and receiver are in the user's wallet list → mark as "internal transfer" (non-taxable)
- Deduplicate so the transfer appears once (not twice from each wallet's perspective)
- For exchange imports, detect duplicates by matching: timestamp (±5min window) + token + amount (±1% tolerance)

### 3.3 EUR Conversion

- Fetch ECB daily reference rates (free, no API key): `https://api.frankfurter.dev` (wraps ECB data, simpler JSON API, supports historical lookups by date)
- Cache rates for the session
- Each transaction's USD value converted to EUR using the rate from its transaction date
- Current holdings use today's rate
- Fallback: if no rate for a specific date (weekends/holidays), use the most recent available rate

---

## 4. Finnish Tax Logic (Vero)

### 4.1 Transaction Categorization

| Category | Events | Taxable? |
|----------|--------|----------|
| **Disposal** | Sell crypto for fiat, crypto-to-crypto swap, NFT sale | Yes — capital gains |
| **Income** | Airdrops, staking rewards, mining rewards | Yes — earned income |
| **Transfer** | Between own wallets, deposit/withdraw to exchange | No |
| **Purchase** | Buy crypto with fiat | No (establishes cost basis) |

### 4.2 Capital Gains Calculation

**FIFO method** (First In, First Out) as required by Vero:
- Track acquisition cost per token across all wallets and exchange imports
- On disposal: match against earliest acquisition lots first
- Gas fees and exchange fees are deductible expenses

**Formula per disposal:**
```
Gain/Loss = Disposal proceeds (EUR) - Acquisition cost (FIFO, EUR) - Gas fees (EUR) - Exchange fees (EUR)
```

**Hankintameno-olettama (Deemed acquisition cost):**
- 20% of sale price if held < 10 years
- 40% of sale price if held >= 10 years
- App calculates both actual cost and deemed cost, uses whichever is more favorable

### 4.3 Tax Rates

- Capital gains: 30% on first 30,000 EUR, 34% on amounts above
- Losses deductible from capital gains for 5 years
- Income (airdrops, staking): taxed at progressive earned income rates

### 4.4 Cost & Expense Tracking

| Item | Source |
|------|--------|
| Gas fees | `getWalletHistory` — gas_used * gas_price per tx |
| Acquisition cost | FIFO from buy transactions + exchange imports |
| Exchange fees | Parsed from CSV imports (Binance, Crypto.com, Revolut fee columns) |
| Total cost per disposal | Cost basis + gas + exchange fees |

---

## 5. Exchange Import

### 5.1 Supported Formats

| Exchange | File Format | Key Columns |
|----------|-------------|-------------|
| Binance | CSV | UTC_Time, Operation, Coin, Change, Fee, Fee_Coin |
| Crypto.com | CSV | Timestamp, Transaction Description, Currency, Amount, Native Amount (EUR) |
| Revolut | CSV | Completed Date, Description, Amount, Currency, Fee |
| Generic CSV | User-mapped columns | Flexible column mapping |

### 5.2 Import Flow

1. User opens import modal, selects exchange or "Generic CSV"
2. Drag-and-drop or file picker for CSV upload
3. Client-side parsing with exchange-specific column mappers
4. Preview of parsed transactions before confirming import
5. Imported transactions merge into unified timeline with `source: "binance" | "crypto.com" | "revolut" | "csv"`
6. Duplicate detection against on-chain data (timestamp + amount + token tolerance matching)

---

## 6. "Cook the Books" — AI Chat (Claude API)

### 6.1 Architecture

- "Cook the Books" slide-over drawer from right side, ~400px wide, accessible from any page via floating button labeled "Cook the Books"
- Subtitle: "Use Claude to ask questions or cook the books"
- Chat input at bottom, message bubbles above
- Backend `/api/chat` route proxies to Claude API
- Sends current report data summary + user message as context
- Claude returns structured JSON modifications

### 6.2 Data Model

```typescript
type ReportModification = {
  id: string;
  description: string;           // "Removed all USDC transactions"
  type: "filter" | "recategorize" | "exclude" | "custom";
  filter?: TransactionFilter;
  recategorizations?: { txHash: string; newCategory: TaxCategory }[];
  excludedTxHashes?: string[];
  active: boolean;               // Toggle on/off
};
```

### 6.3 UX

- Active modifications shown as pills/chips above the chat input (click X to remove)
- "Reset all modifications" button
- All modifications are non-destructive — original data preserved, filters applied as overlays
- Each modification toggleable independently
- Chat history persists for session
- Example prompts shown when chat is empty: "Remove all USDC transactions", "Show only disposals above 1000 EUR", "Recategorize this as income"

### 6.4 Claude API Integration

- Model: claude-sonnet-4-6 (fast, cost-effective for structured outputs)
- System prompt instructs Claude to return JSON filter objects
- User message + current transaction summary sent as context
- Response parsed and applied to the report data
- Requires `ANTHROPIC_API_KEY` in `.env`

---

## 7. Lomake 9 (Form 9) Generation

### 7.1 Overview

Vero's Lomake 9 is the official capital gains/losses form. One form per disposal event. The app generates pre-filled PDFs using the original Lomake 9 template.

### 7.2 Implementation

- Use `pdf-lib` to fill AcroForm fields in the template PDF
- Template stored at `/public/lomake9-template.pdf`

### 7.3 Field Mapping

| Field ID | Lomake 9 Field | Source |
|----------|---------------|--------|
| `020` | Nimi (Name) | User input (settings) |
| `901` | Henkilötunnus (SSN) | User input (settings) |
| `902` | Verovuosi (Tax year) | Selected tax year |
| `900` | Kryptovarat checkbox | Always checked |
| `938;1` | Kryptovarojen nimet | Token name(s) in the disposal |
| `908` | Luovutuspäivä (Disposal date) | Transaction date (ddmmyyyy) |
| `909` | Hankintapäivä (Acquisition date) | FIFO lot date (ddmmyyyy) |
| `921`/`s921` | 4.1 Myyntihinta (Sale price) | Disposal proceeds EUR/cents |
| `922`/`s922` | 4.2 Hankintahinta (Acquisition cost) | FIFO cost basis EUR/cents |
| `925`/`s925` | 4.5 Hankkimismenot (Acquisition expenses) | Gas + exchange fees EUR/cents |
| `928`/`s928` | 4.8 Hankintameno-olettama | 20% or 40% of sale price |
| `929`/`s929` | 4.9 Luovutusvoitto (Gain) | If positive result |
| `930`/`s930` | 4.10 Luovutustappio (Loss) | If negative result |
| `Paivays` | Date | Current date |

### 7.4 Download Options

- **Single form:** Download one Lomake 9 for a specific disposal
- **Batch ZIP:** Download all Lomake 9 forms for the tax year as a ZIP
- **Both actual cost and hankintameno-olettama** calculated; form uses the more favorable option
- User can override and choose which method per disposal

---

## 8. Report Exports

### 8.1 PDF Tax Report

Full tax report with:
- Cover page: user info, tax year, summary
- Summary section: total realized gains, unrealized gains, income, fees, tax liability estimate
- Transaction detail table: all transactions with categories, EUR values, gains/losses
- Wallet breakdown
- Chain breakdown
- Respects current filter/toggle state (AI modifications applied)

### 8.2 CSV Export

Format selector:
- **Generic:** All columns, semicolon-separated (Finnish locale)
- **Koinly:** Koinly-compatible column mapping
- **TurboTax:** TurboTax import format
- **OmaVero:** Simplified format matching Vero's expected data

### 8.3 Lomake 9 PDF

As described in Section 7. One pre-filled form per disposal event.

---

## 9. UI Design

### 9.1 Layout

- **Sidebar (left, collapsible):** Wallet management, exchange imports, tax year selector, navigation
- **Main content area:** Current page view
- **AI Chat drawer (right, slide-over):** Always accessible via floating button

### 9.2 Pages

**Dashboard:**
- 5 summary cards: Total Realized Gains, Unrealized Gains, Total Income, Total Fees & Costs, Net Position
- Tax liability estimate card (30%/34% rates applied)
- Chain breakdown bar chart
- Wallet breakdown pie chart
- Quick stats row: total transactions, active chains, tokens held

**Transactions:**
- Filterable/sortable table
- Columns: Date, Type, Token, Amount, EUR Value, From, To, Wallet (color-coded), Category, Source
- Category badges: Disposal (red), Income (green), Transfer (gray), Purchase (blue)
- Inline category override dropdown per row
- Search + column filters + date range picker
- Cursor-based pagination

**Holdings:**
- Current portfolio across all wallets
- Token rows: Logo, Name, Balance, EUR Value, 24h Change, Allocation %
- Grouped by wallet or flat view toggle
- Total portfolio value header

**Reports:**
- Tax report preview
- Export buttons: PDF Report, CSV (with format picker), Lomake 9 (single or batch)
- User info form (name, henkilötunnus) for Lomake 9 generation

### 9.3 Visual Design

- **Dark mode only** (primary theme)
- Background: `#0a0a0f`
- Card surfaces: `#141420`
- Accent: Purple/blue gradient for primary actions
- Wallet colors: 10-color palette for wallet identification
- Category colors: Red (disposal), Green (income), Gray (transfer), Blue (purchase)
- Font: Inter (system fallback)
- shadcn/ui components throughout for consistency

### 9.4 Toggleability

- Every column in transaction table can be shown/hidden
- Every data source (wallet, exchange import) can be toggled on/off
- Tax categories overridable per transaction
- All summary numbers update in real-time as filters/toggles change
- Report exports respect current filter/toggle state

---

## 10. Environment Variables

```env
MORALIS_API_KEY=        # Required — Moralis Data API
ANTHROPIC_API_KEY=      # Required — Claude API for AI chat
```

No database, no auth — this is a personal tool. User info (name, henkilötunnus) stored in localStorage for Lomake 9 generation.

---

## 11. Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` 14.x | Framework |
| `react` 18.x | UI |
| `tailwindcss` 3.x | Styling |
| `@shadcn/ui` | Component library |
| `pdf-lib` | Lomake 9 PDF form filling |
| `jspdf` + `jspdf-autotable` | Tax report PDF generation |
| `@anthropic-ai/sdk` | Claude API for AI chat |
| `recharts` | Charts (dashboard) |
| `date-fns` | Date formatting/manipulation |
| `jszip` | Batch Lomake 9 ZIP download |
| `papaparse` | CSV parsing (exchange imports) + CSV export |
| `zustand` | Client-side state management |

---

## 12. Notifications & Warnings

### 12.1 Warning Triggers

| Trigger | Severity | Message |
|---------|----------|---------|
| Missing acquisition cost (cost basis unknown) | Error | "Missing acquisition cost for [token] — add manually or import exchange data" |
| Unknown transaction type (can't auto-categorize) | Warning | "Could not categorize transaction — please review" |
| Large disposal (> 10,000 EUR) | Info | "Large disposal detected — verify details" |
| Possible duplicate (exchange import vs on-chain) | Warning | "Possible duplicate — review and confirm" |
| Moralis API error (timeout, chain unsupported) | Error | "Failed to fetch data for [chain] — retry or skip" |
| Missing EUR rate (ECB data gap) | Warning | "EUR rate unavailable for [date] — using nearest available" |
| Deemed cost more favorable | Info | "Hankintameno-olettama (20%/40%) is more favorable for this disposal" |

### 12.2 Notification UX

- **Toast notifications** (bottom-right) for real-time alerts during data loading
- **Warning badges** on affected transaction rows (yellow triangle icon)
- **Dashboard issues card:** "X issues require attention" linking to filtered view
- **Issues filter:** Toggle to show only transactions with warnings
- Warnings are dismissible per-transaction after user reviews them
- Critical issues (missing cost basis) block Lomake 9 generation for that disposal until resolved

---

## 13. Scope Boundaries

**In scope:**
- Multi-wallet on-chain transaction history via Moralis
- Finnish tax categorization and FIFO cost basis
- Lomake 9 form generation
- Exchange CSV import (Binance, Crypto.com, Revolut)
- AI chat for report modifications
- PDF/CSV exports
- EUR conversion via ECB rates

**Out of scope:**
- User authentication / multi-user support
- Database persistence (session-only)
- DeFi position tracking (LP, lending, etc.)
- NFT-specific tax handling (treated as generic disposals)
- Solana chain support (EVM only)
- Real-time streaming (Moralis Streams not needed)
- Mobile-responsive layout (desktop-first)
