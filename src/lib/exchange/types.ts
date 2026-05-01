export interface ParsedTransaction {
  date: Date;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'trade' | 'staking_reward' | 'airdrop' | 'fee' | 'other';
  tokenSymbol: string;
  amount: number;
  feeAmount?: number;
  feeCurrency?: string;
  counterTokenSymbol?: string;  // For trades/swaps
  counterAmount?: number;
  priceEur?: number;  // If exchange provides EUR price
  priceUsd?: number;
  rawRow: Record<string, string>;  // Original CSV row
}

export interface ExchangeParser {
  name: string;
  parse(csvContent: string): ParsedTransaction[];
}

export interface ExchangeInstruction {
  exchange: string;
  logo: string; // emoji
  csvSteps: string[];
  apiSteps: string[];
  apiKeyUrl: string;
  csvUrl: string;
  requiredPermissions: string[];
  notes: string[];
}
