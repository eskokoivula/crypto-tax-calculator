import Papa from 'papaparse';
import type { ParsedTransaction } from '../types';

export interface ColumnMapping {
  date: string;
  type?: string;
  token: string;
  amount: string;
  fee?: string;
  feeCurrency?: string;
  price?: string;
  counterToken?: string;
  counterAmount?: string;
}

const TYPE_ALIASES: Record<string, ParsedTransaction['type']> = {
  'buy': 'buy',
  'purchase': 'buy',
  'bought': 'buy',
  'sell': 'sell',
  'sold': 'sell',
  'deposit': 'deposit',
  'receive': 'deposit',
  'received': 'deposit',
  'withdrawal': 'withdrawal',
  'withdraw': 'withdrawal',
  'sent': 'withdrawal',
  'send': 'withdrawal',
  'trade': 'trade',
  'swap': 'trade',
  'exchange': 'trade',
  'staking': 'staking_reward',
  'staking_reward': 'staking_reward',
  'reward': 'staking_reward',
  'interest': 'staking_reward',
  'airdrop': 'airdrop',
  'fee': 'fee',
  'commission': 'fee',
};

function inferType(value: string, amount: number): ParsedTransaction['type'] {
  const normalized = value.toLowerCase().trim();

  if (TYPE_ALIASES[normalized]) {
    return TYPE_ALIASES[normalized];
  }

  // Check partial matches
  for (const [key, type] of Object.entries(TYPE_ALIASES)) {
    if (normalized.includes(key)) return type;
  }

  // Infer from amount sign
  if (amount < 0) return 'sell';
  if (amount > 0) return 'buy';

  return 'other';
}

export function parseGenericCsv(csvContent: string, mapping: ColumnMapping): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data) {
    const dateStr = row[mapping.date] || '';
    const token = row[mapping.token] || '';
    const amountStr = row[mapping.amount] || '0';

    if (!dateStr || !token) continue;

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    const typeStr = mapping.type ? (row[mapping.type] || '') : '';
    const type = typeStr ? inferType(typeStr, amount) : (amount >= 0 ? 'buy' : 'sell');

    const feeStr = mapping.fee ? (row[mapping.fee] || '0') : '0';
    const fee = parseFloat(feeStr);

    const priceStr = mapping.price ? (row[mapping.price] || '0') : '0';
    const price = parseFloat(priceStr);

    const counterAmountStr = mapping.counterAmount ? (row[mapping.counterAmount] || '0') : '0';
    const counterAmount = parseFloat(counterAmountStr);

    const tx: ParsedTransaction = {
      date: new Date(dateStr),
      type,
      tokenSymbol: token.toUpperCase(),
      amount: Math.abs(amount),
      rawRow: { ...row },
    };

    if (mapping.fee && !isNaN(fee) && fee !== 0) {
      tx.feeAmount = Math.abs(fee);
      tx.feeCurrency = mapping.feeCurrency ? (row[mapping.feeCurrency] || undefined) : undefined;
    }

    if (mapping.price && !isNaN(price) && price !== 0) {
      tx.priceUsd = price;
    }

    if (mapping.counterToken && row[mapping.counterToken]) {
      tx.counterTokenSymbol = row[mapping.counterToken].toUpperCase();
    }

    if (mapping.counterAmount && !isNaN(counterAmount) && counterAmount !== 0) {
      tx.counterAmount = Math.abs(counterAmount);
    }

    transactions.push(tx);
  }

  return transactions;
}

/**
 * Detect CSV headers for column mapping UI
 */
export function detectCsvHeaders(csvContent: string): string[] {
  const result = Papa.parse(csvContent, {
    header: true,
    preview: 1,
  });

  return result.meta.fields || [];
}
