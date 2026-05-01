import Papa from 'papaparse';
import type { ExchangeParser, ParsedTransaction } from '../types';

const OPERATION_TYPE_MAP: Record<string, ParsedTransaction['type']> = {
  'buy': 'buy',
  'sell': 'sell',
  'deposit': 'deposit',
  'withdraw': 'withdrawal',
  'withdrawal': 'withdrawal',
  'staking rewards': 'staking_reward',
  'staking interest': 'staking_reward',
  'pos savings interest': 'staking_reward',
  'savings interest': 'staking_reward',
  'eth 2.0 staking rewards': 'staking_reward',
  'launchpool interest': 'staking_reward',
  'distribution': 'airdrop',
  'airdrop': 'airdrop',
  'fee': 'fee',
  'transaction fee': 'fee',
  'small assets exchange bnb': 'sell',
  'commission fee shared with you': 'staking_reward',
  'commission history': 'staking_reward',
  'referral kickback': 'staking_reward',
  'cash voucher': 'airdrop',
  'transfer': 'deposit',
};

function parseBinanceDate(dateStr: string): Date {
  // Binance uses various formats:
  // "2023-01-15 12:30:45" (most common)
  // "2023-01-15T12:30:45Z"
  // "01/15/2023 12:30:45"
  const trimmed = dateStr.trim();

  // ISO format
  if (trimmed.includes('T')) {
    return new Date(trimmed);
  }

  // MM/DD/YYYY format
  if (trimmed.includes('/')) {
    const [datePart, timePart] = trimmed.split(' ');
    const [month, day, year] = datePart.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00:00'}Z`);
  }

  // YYYY-MM-DD HH:mm:ss format (most common)
  return new Date(trimmed.replace(' ', 'T') + 'Z');
}

function mapOperationType(operation: string): ParsedTransaction['type'] {
  const normalized = operation.toLowerCase().trim();

  // Direct match
  if (OPERATION_TYPE_MAP[normalized]) {
    return OPERATION_TYPE_MAP[normalized];
  }

  // Partial matches
  if (normalized.startsWith('trading:') || normalized.includes('trade')) return 'trade';
  if (normalized.includes('buy')) return 'buy';
  if (normalized.includes('sell')) return 'sell';
  if (normalized.includes('deposit') || normalized.includes('fiat deposit')) return 'deposit';
  if (normalized.includes('withdraw')) return 'withdrawal';
  if (normalized.includes('staking') || normalized.includes('interest')) return 'staking_reward';
  if (normalized.includes('distribution') || normalized.includes('airdrop')) return 'airdrop';
  if (normalized.includes('fee') || normalized.includes('commission')) return 'fee';

  return 'other';
}

function detectColumnFormat(headers: string[]): 'standard' | 'new' | 'unknown' {
  const normalized = headers.map((h) => h.toLowerCase().trim());

  // Standard format: UTC_Time, Account, Operation, Coin, Change, Remark
  if (normalized.includes('utc_time') && normalized.includes('operation') && normalized.includes('coin')) {
    return 'standard';
  }

  // Newer format may use different column names
  if (normalized.includes('date(utc)') && normalized.includes('market') && normalized.includes('type')) {
    return 'new';
  }

  return 'unknown';
}

export const binanceParser: ExchangeParser = {
  name: 'Binance',

  parse(csvContent: string): ParsedTransaction[] {
    const result = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`CSV parse error: ${result.errors[0].message}`);
    }

    const headers = result.meta.fields || [];
    const format = detectColumnFormat(headers);

    if (format === 'new') {
      return parseNewFormat(result.data);
    }

    // Default to standard format
    return parseStandardFormat(result.data);
  },
};

function parseStandardFormat(rows: Record<string, string>[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = row['UTC_Time'] || row['utc_time'] || row['Date(UTC)'] || row['Date'];
    const operation = row['Operation'] || row['operation'] || row['Type'] || '';
    const coin = row['Coin'] || row['coin'] || row['Asset'] || '';
    const changeStr = row['Change'] || row['change'] || row['Amount'] || '0';

    if (!dateStr || !coin) continue;

    const amount = parseFloat(changeStr);
    if (isNaN(amount)) continue;

    const type = mapOperationType(operation);

    transactions.push({
      date: parseBinanceDate(dateStr),
      type,
      tokenSymbol: coin.toUpperCase(),
      amount: Math.abs(amount),
      rawRow: { ...row },
    });
  }

  return transactions;
}

function parseNewFormat(rows: Record<string, string>[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = row['Date(UTC)'] || row['Date'] || '';
    const market = row['Market'] || row['Pair'] || '';
    const side = (row['Type'] || row['Side'] || '').toLowerCase();
    const priceStr = row['Price'] || '0';
    const amountStr = row['Amount'] || row['Quantity'] || '0';
    const totalStr = row['Total'] || '0';
    const feeStr = row['Fee'] || '0';
    const feeCoin = row['Fee Coin'] || row['Fee Currency'] || '';

    if (!dateStr || !market) continue;

    const amount = parseFloat(amountStr);
    const total = parseFloat(totalStr);
    const fee = parseFloat(feeStr);
    const price = parseFloat(priceStr);
    if (isNaN(amount)) continue;

    // Extract tokens from pair (e.g., "BTCUSDT" or "BTC/USDT")
    const pairMatch = market.match(/^([A-Z]+)[/_]?([A-Z]+)$/);
    const baseToken = pairMatch ? pairMatch[1] : market;
    const quoteToken = pairMatch ? pairMatch[2] : 'USDT';

    const type = side === 'buy' ? 'buy' : side === 'sell' ? 'sell' : 'trade';

    transactions.push({
      date: parseBinanceDate(dateStr),
      type,
      tokenSymbol: baseToken,
      amount: Math.abs(amount),
      counterTokenSymbol: quoteToken,
      counterAmount: isNaN(total) ? undefined : Math.abs(total),
      feeAmount: isNaN(fee) ? undefined : Math.abs(fee),
      feeCurrency: feeCoin || undefined,
      priceUsd: quoteToken === 'USDT' || quoteToken === 'BUSD' ? price : undefined,
      rawRow: { ...row },
    });
  }

  return transactions;
}
