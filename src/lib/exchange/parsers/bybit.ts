import Papa from 'papaparse';
import type { ExchangeParser, ParsedTransaction } from '../types';

// Common trading pairs and their token splits
// Bybit pairs are concatenated like "BTCUSDT", "ETHBTC", etc.
const KNOWN_QUOTE_TOKENS = ['USDT', 'USDC', 'BUSD', 'DAI', 'EUR', 'USD', 'BTC', 'ETH', 'BNB'];

function splitPair(pair: string): { base: string; quote: string } {
  // Try slash separator first
  if (pair.includes('/')) {
    const [base, quote] = pair.split('/');
    return { base, quote };
  }

  // Try known quote tokens (longest match first)
  const sorted = [...KNOWN_QUOTE_TOKENS].sort((a, b) => b.length - a.length);
  for (const quote of sorted) {
    if (pair.endsWith(quote) && pair.length > quote.length) {
      return { base: pair.slice(0, -quote.length), quote };
    }
  }

  // Fallback: assume last 4 chars are quote
  if (pair.length > 4) {
    return { base: pair.slice(0, -4), quote: pair.slice(-4) };
  }

  return { base: pair, quote: 'USDT' };
}

function parseBybitDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // Unix timestamp (ms)
  if (/^\d{13}$/.test(trimmed)) {
    return new Date(parseInt(trimmed, 10));
  }

  // Unix timestamp (s)
  if (/^\d{10}$/.test(trimmed)) {
    return new Date(parseInt(trimmed, 10) * 1000);
  }

  // Standard date format
  if (trimmed.includes('T') || trimmed.includes(' ')) {
    return new Date(trimmed.replace(' ', 'T') + (trimmed.includes('Z') ? '' : 'Z'));
  }

  return new Date(trimmed);
}

export const bybitParser: ExchangeParser = {
  name: 'Bybit',

  parse(csvContent: string): ParsedTransaction[] {
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
      const dateStr = row['Date(UTC)'] || row['Date'] || row['Create Time'] || row['Timestamp'] || '';
      const pair = row['Pair'] || row['Symbol'] || row['Market'] || '';
      const side = (row['Side'] || row['Direction'] || row['Type'] || '').toLowerCase().trim();
      const orderPrice = row['Order Price'] || row['Price'] || '0';
      const executedPrice = row['Executed Price'] || row['Avg. Price'] || orderPrice;
      const executedQty = row['Executed Quantity'] || row['Order Quantity'] || row['Qty'] || row['Amount'] || '0';
      const feeStr = row['Trading Fee'] || row['Fee'] || '0';
      const feeCurrency = row['Trading Fee Currency'] || row['Fee Currency'] || '';

      if (!dateStr || !pair) continue;

      const qty = parseFloat(executedQty);
      const price = parseFloat(executedPrice);
      const fee = parseFloat(feeStr);
      if (isNaN(qty) || qty === 0) continue;

      const { base, quote } = splitPair(pair);
      const type = side === 'buy' ? 'buy' as const : side === 'sell' ? 'sell' as const : 'trade' as const;

      const counterAmount = !isNaN(price) ? Math.abs(qty * price) : undefined;

      transactions.push({
        date: parseBybitDate(dateStr),
        type,
        tokenSymbol: base.toUpperCase(),
        amount: Math.abs(qty),
        counterTokenSymbol: quote.toUpperCase(),
        counterAmount,
        feeAmount: !isNaN(fee) ? Math.abs(fee) : undefined,
        feeCurrency: feeCurrency || undefined,
        priceUsd: (quote === 'USDT' || quote === 'USDC') && !isNaN(price) ? price : undefined,
        rawRow: { ...row },
      });
    }

    return transactions;
  },
};
