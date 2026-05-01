// Chain IDs — all major EVM chains + Solana
export type ChainId =
  | '0x1' | '0x89' | '0x2105' | '0x38' | '0xa4b1' | '0xa' | '0xa86a'
  | '0xfa' | '0x19' | '0xe708' | '0x2019' | '0xa4ec' | '0x171'
  | '0x138d4' | '0x531' | '0x8f'
  | 'solana';

export const CHAIN_NAMES: Record<ChainId, string> = {
  '0x1': 'Ethereum',
  '0x89': 'Polygon',
  '0x2105': 'Base',
  '0x38': 'BNB Chain',
  '0xa4b1': 'Arbitrum',
  '0xa': 'Optimism',
  '0xa86a': 'Avalanche',
  '0xfa': 'Fantom',
  '0x19': 'Cronos',
  '0xe708': 'Linea',
  '0x2019': 'Sonic',
  '0xa4ec': 'Celo',
  '0x171': 'Pulse',
  '0x138d4': 'Flow',
  '0x531': 'Sei',
  '0x8f': 'Monad',
  'solana': 'Solana',
};

export const PROFITABILITY_CHAINS: ChainId[] = ['0x1', '0x89', '0x2105'];

// Chains that support EVM wallet history
export const EVM_CHAINS: ChainId[] = [
  '0x1', '0x89', '0x2105', '0x38', '0xa4b1', '0xa', '0xa86a',
  '0xfa', '0x19', '0xe708', '0x2019', '0xa4ec', '0x171', '0x138d4', '0x531', '0x8f',
];

export type WalletType = 'evm' | 'solana';

export type TaxCategory = 'disposal' | 'income' | 'transfer' | 'purchase';

export type WarningSeverity = 'error' | 'warning' | 'info';

export type ExchangeSource = 'binance' | 'crypto.com' | 'revolut' | 'bybit' | 'csv' | 'onchain';

export interface Wallet {
  address: string;
  label: string;
  color: string;
  enabled: boolean;
  detectedChains: ChainId[];
  loading: boolean;
  type: WalletType;
}

export interface Transaction {
  id: string; // txHash + logIndex or unique id for exchange imports
  txHash: string;
  blockNumber: number;
  timestamp: string; // ISO string
  date: Date;
  chain: ChainId;
  walletAddress: string;
  from: string;
  to: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string; // raw amount string
  amountFormatted: number;
  valueUsd: number;
  valueEur: number;
  gasFeeEur: number;
  exchangeFeeEur: number;
  category: TaxCategory;
  categoryOverride?: TaxCategory;
  source: ExchangeSource;
  summary?: string; // Moralis decoded summary
  costBasisEur?: number; // FIFO computed
  gainLossEur?: number; // For disposals
  usedDeemedCost?: boolean; // True if hankintameno-olettama was more favorable
  warnings: Warning[];
  isInternalTransfer: boolean;
  dismissed: boolean; // User dismissed warnings
}

export interface CostBasisLot {
  token: string;
  amount: number;
  remaining: number;
  costEurPerUnit: number;
  totalCostEur: number;
  acquisitionDate: Date;
  source: ExchangeSource;
  txHash?: string;
}

export interface Warning {
  id: string;
  severity: WarningSeverity;
  message: string;
  transactionId?: string;
  dismissed: boolean;
}

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  logo?: string;
  balance: string;
  balanceFormatted: number;
  decimals: number;
  usdPrice: number;
  eurValue: number;
  portfolioPercentage: number;
  chain: ChainId;
  walletAddress: string;
  priceChange24h?: number;
}

export interface ProfitabilityData {
  tokenAddress: string;
  tokenSymbol: string;
  avgBuyPriceUsd: number;
  avgSellPriceUsd: number;
  totalInvestedUsd: number;
  totalSoldUsd: number;
  realizedProfitUsd: number;
  realizedProfitEur: number;
  unrealizedProfitEur: number;
  tradeCount: number;
  chain: ChainId;
  walletAddress: string;
}

export interface TaxSummary {
  totalRealizedGainsEur: number;
  totalUnrealizedGainsEur: number;
  totalIncomeEur: number;
  totalFeesEur: number;
  netPositionEur: number;
  taxableGainsEur: number;
  estimatedTaxEur: number;
  disposalCount: number;
  incomeCount: number;
  transferCount: number;
  purchaseCount: number;
  issueCount: number;
}

export interface ReportModification {
  id: string;
  description: string;
  type: 'filter' | 'recategorize' | 'exclude' | 'custom';
  filter?: TransactionFilter;
  recategorizations?: { txId: string; newCategory: TaxCategory }[];
  excludedTxIds?: string[];
  active: boolean;
  createdAt: Date;
}

export interface TransactionFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
}

export interface ExchangeImport {
  id: string;
  fileName: string;
  source: ExchangeSource;
  transactions: Transaction[];
  importedAt: Date;
  enabled: boolean;
}

export interface ExchangeApiConnection {
  exchange: ExchangeSource;
  connected: boolean;
  lastSync?: Date;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modification?: ReportModification;
  timestamp: Date;
}

// Wallet color palette (10 distinct colors)
export const WALLET_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
];

export const CATEGORY_COLORS: Record<TaxCategory, string> = {
  disposal: '#ef4444',
  income: '#10b981',
  transfer: '#6b7280',
  purchase: '#3b82f6',
};

// Finnish tax constants
export const FINNISH_TAX = {
  CAPITAL_GAINS_RATE_LOW: 0.30,
  CAPITAL_GAINS_RATE_HIGH: 0.34,
  CAPITAL_GAINS_THRESHOLD: 30000,
  DEEMED_COST_SHORT: 0.20, // < 10 years
  DEEMED_COST_LONG: 0.40,  // >= 10 years
  DEEMED_COST_YEARS_THRESHOLD: 10,
  LOSS_DEDUCTION_YEARS: 5,
};
