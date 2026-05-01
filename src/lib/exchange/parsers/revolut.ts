import Papa from 'papaparse';
import type { ExchangeParser, ParsedTransaction } from '../types';

function parseRevolutDate(dateStr: string): Date {
  // Revolut uses formats like:
  // "2023-01-15 12:30:45"
  // "15 Jan 2023 12:30:45"
  // "Jan 15, 2023"
  const trimmed = dateStr.trim();

  // Try ISO-ish format first
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(trimmed.replace(' ', 'T') + (trimmed.includes('Z') ? '' : 'Z'));
  }

  // Natural language date
  return new Date(trimmed);
}

function mapRevolutType(type: string, amount: number): ParsedTransaction['type'] {
  const normalized = type.toLowerCase().trim();

  if (normalized === 'exchange' || normalized === 'exchanged') return 'trade';
  if (normalized === 'transfer' || normalized === 'sent') {
    return amount < 0 ? 'withdrawal' : 'deposit';
  }
  if (normalized === 'received') return 'deposit';
  if (normalized === 'buy' || normalized === 'purchased') return 'buy';
  if (normalized === 'sell' || normalized === 'sold') return 'sell';
  if (normalized === 'reward' || normalized === 'cashback') return 'staking_reward';
  if (normalized === 'fee') return 'fee';

  return 'other';
}

export const revolutParser: ExchangeParser = {
  name: 'Revolut',

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
      // Only include completed transactions
      const state = (row['State'] || row['Status'] || '').toLowerCase().trim();
      if (state && state !== 'completed') continue;

      const type = row['Type'] || '';
      const product = row['Product'] || '';
      const dateStr = row['Started Date'] || row['Completed Date'] || row['Date'] || '';
      const amountStr = row['Amount'] || '0';
      const currency = row['Currency'] || row['Symbol'] || '';
      const fiatAmountStr = row['Fiat amount'] || row['Fiat Amount'] || '';
      const fiatAmountInclFeesStr = row['Fiat amount (inc. fees)'] || '';
      const feeStr = row['Fee'] || '0';
      const baseCurrency = row['Base currency'] || row['Base Currency'] || 'EUR';
      const description = row['Description'] || '';

      if (!dateStr || !currency) continue;

      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      const fee = parseFloat(feeStr);
      const fiatAmount = parseFloat(fiatAmountStr);
      const txType = mapRevolutType(type, amount);

      const tx: ParsedTransaction = {
        date: parseRevolutDate(dateStr),
        type: txType,
        tokenSymbol: currency.toUpperCase(),
        amount: Math.abs(amount),
        feeAmount: !isNaN(fee) ? Math.abs(fee) : undefined,
        feeCurrency: !isNaN(fee) && fee !== 0 ? baseCurrency : undefined,
        priceEur: !isNaN(fiatAmount) && amount !== 0 && baseCurrency === 'EUR'
          ? Math.abs(fiatAmount / amount)
          : undefined,
        rawRow: { ...row },
      };

      // For exchanges, try to extract the counter token from description
      // Revolut descriptions look like "Exchanged to BTC" or "Exchanged from EUR"
      if (txType === 'trade' && description) {
        const exchangeMatch = description.match(/(?:to|from)\s+([A-Z]{2,10})/i);
        if (exchangeMatch) {
          tx.counterTokenSymbol = exchangeMatch[1].toUpperCase();
        }
      }

      transactions.push(tx);
    }

    return transactions;
  },
};
