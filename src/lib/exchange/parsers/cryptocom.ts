import Papa from 'papaparse';
import type { ExchangeParser, ParsedTransaction } from '../types';

const TRANSACTION_KIND_MAP: Record<string, ParsedTransaction['type']> = {
  'crypto_purchase': 'buy',
  'crypto_viban_purchase': 'buy',
  'viban_purchase': 'buy',
  'dust_conversion_credited': 'buy',
  'dust_conversion_debited': 'sell',
  'crypto_viban_exchange': 'trade',
  'crypto_exchange': 'trade',
  'rewards_platform_deposit_credited': 'staking_reward',
  'crypto_earn_interest_paid': 'staking_reward',
  'mco_stake_reward': 'staking_reward',
  'crypto_earn_program_created': 'other',
  'crypto_earn_program_withdrawn': 'other',
  'referral_card_cashback': 'staking_reward',
  'reimbursement': 'staking_reward',
  'card_cashback_reverted': 'fee',
  'crypto_withdrawal': 'withdrawal',
  'crypto_deposit': 'deposit',
  'viban_deposit': 'deposit',
  'crypto_to_exchange_transfer': 'withdrawal',
  'exchange_to_crypto_transfer': 'deposit',
  'lockup_lock': 'other',
  'lockup_unlock': 'other',
  'supercharger_deposit': 'other',
  'supercharger_withdrawal': 'other',
  'supercharger_reward_to_app_credited': 'staking_reward',
  'crypto_payment': 'sell',
  'card_top_up': 'sell',
};

function parseCryptoComDate(dateStr: string): Date {
  // Crypto.com uses various formats:
  // "2023-01-15 12:30:45"
  // "15/01/2023 12:30"
  const trimmed = dateStr.trim();

  // DD/MM/YYYY format
  if (trimmed.includes('/')) {
    const [datePart, timePart] = trimmed.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00'}:00Z`);
  }

  // YYYY-MM-DD HH:mm:ss
  return new Date(trimmed.replace(' ', 'T') + 'Z');
}

export const cryptoComParser: ExchangeParser = {
  name: 'Crypto.com',

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
      const dateStr = row['Timestamp (UTC)'] || row['Timestamp'] || row['Date'] || '';
      const currency = row['Currency'] || '';
      const amountStr = row['Amount'] || '0';
      const toCurrency = row['To Currency'] || '';
      const toAmountStr = row['To Amount'] || '';
      const nativeAmountStr = row['Native Amount'] || '';
      const nativeAmountUsdStr = row['Native Amount (in USD)'] || '';
      const transactionKind = (row['Transaction Kind'] || row['Transaction Description'] || '').toLowerCase().trim();

      if (!dateStr || !currency) continue;

      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      const type = TRANSACTION_KIND_MAP[transactionKind] || 'other';
      const toAmount = parseFloat(toAmountStr);
      const nativeAmountUsd = parseFloat(nativeAmountUsdStr);
      const nativeAmount = parseFloat(nativeAmountStr);

      const tx: ParsedTransaction = {
        date: parseCryptoComDate(dateStr),
        type,
        tokenSymbol: currency.toUpperCase(),
        amount: Math.abs(amount),
        priceUsd: !isNaN(nativeAmountUsd) && amount !== 0
          ? Math.abs(nativeAmountUsd / amount)
          : undefined,
        priceEur: !isNaN(nativeAmount) && amount !== 0
          ? Math.abs(nativeAmount / amount)
          : undefined,
        rawRow: { ...row },
      };

      // Add counter token for exchanges/trades
      if (toCurrency && !isNaN(toAmount)) {
        tx.counterTokenSymbol = toCurrency.toUpperCase();
        tx.counterAmount = Math.abs(toAmount);
      }

      transactions.push(tx);
    }

    return transactions;
  },
};
