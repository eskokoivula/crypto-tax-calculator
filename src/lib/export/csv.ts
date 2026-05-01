import Papa from 'papaparse';
import type { Transaction } from '@/types';
import { formatDate } from '@/lib/utils';
import type { CsvFormat } from './types';

/**
 * Generate a CSV string for the given transactions in the requested format.
 */
export function generateCsv(
  transactions: Transaction[],
  format: CsvFormat,
): string {
  switch (format) {
    case 'generic':
      return generateGenericCsv(transactions);
    case 'koinly':
      return generateKoinlyCsv(transactions);
    case 'turbotax':
      return generateTurboTaxCsv(transactions);
    case 'omavero':
      return generateOmaVeroCsv(transactions);
  }
}

// ---------------------------------------------------------------------------
// Generic CSV — semicolon separator, comma decimals (Finnish convention)
// ---------------------------------------------------------------------------

function generateGenericCsv(transactions: Transaction[]): string {
  const rows = transactions.map((tx) => ({
    Date: formatDate(tx.timestamp),
    Token: tx.tokenSymbol,
    Type: effectiveCategory(tx),
    Amount: tx.amountFormatted,
    'EUR Value': tx.valueEur,
    'Cost Basis': tx.costBasisEur ?? '',
    'Gain/Loss': tx.gainLossEur ?? '',
    Category: effectiveCategory(tx),
    Wallet: tx.walletAddress,
    Chain: tx.chain,
    Source: tx.source,
    Fees: (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0),
    'Tx Hash': tx.txHash,
  }));

  return Papa.unparse(rows, { delimiter: ';' });
}

// ---------------------------------------------------------------------------
// Koinly format
// ---------------------------------------------------------------------------

function generateKoinlyCsv(transactions: Transaction[]): string {
  const rows = transactions.map((tx) => {
    const cat = effectiveCategory(tx);
    const isSend = cat === 'disposal' || cat === 'transfer';
    return {
      Date: new Date(tx.timestamp).toISOString(),
      'Sent Amount': isSend ? tx.amountFormatted : '',
      'Sent Currency': isSend ? tx.tokenSymbol : '',
      'Received Amount': !isSend ? tx.amountFormatted : '',
      'Received Currency': !isSend ? tx.tokenSymbol : '',
      'Fee Amount': (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0) || '',
      'Fee Currency': (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0) ? 'EUR' : '',
      'Net Worth Amount': tx.valueEur || '',
      'Net Worth Currency': tx.valueEur ? 'EUR' : '',
      Label: mapCategoryToKoinlyLabel(cat),
      Description: tx.summary ?? '',
      TxHash: tx.txHash,
    };
  });

  return Papa.unparse(rows, { delimiter: ',' });
}

// ---------------------------------------------------------------------------
// TurboTax format
// ---------------------------------------------------------------------------

function generateTurboTaxCsv(transactions: Transaction[]): string {
  const rows = transactions.map((tx) => ({
    Date: new Date(tx.timestamp).toISOString().slice(0, 10),
    Action: effectiveCategory(tx).toUpperCase(),
    Source: tx.source,
    Volume: tx.amountFormatted,
    Symbol: tx.tokenSymbol,
    Price: tx.valueEur / (tx.amountFormatted || 1),
    Fee: (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0),
    FeeCurrency: 'EUR',
    Total: tx.valueEur,
  }));

  return Papa.unparse(rows, { delimiter: ',' });
}

// ---------------------------------------------------------------------------
// OmaVero — simplified Finnish format for manual entry
// ---------------------------------------------------------------------------

function generateOmaVeroCsv(transactions: Transaction[]): string {
  const rows = transactions.map((tx) => ({
    'Paivamaara': formatDate(tx.timestamp),
    Tyyppi: effectiveCategory(tx),
    Kryptovaluutta: tx.tokenSymbol,
    'Maara': tx.amountFormatted,
    'Arvo EUR': tx.valueEur,
    'Hankintahinta EUR': tx.costBasisEur ?? '',
    'Voitto/Tappio EUR': tx.gainLossEur ?? '',
  }));

  return Papa.unparse(rows, { delimiter: ';' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function effectiveCategory(tx: Transaction): string {
  return tx.categoryOverride ?? tx.category;
}

function mapCategoryToKoinlyLabel(category: string): string {
  switch (category) {
    case 'income':
      return 'income';
    case 'disposal':
      return 'realized_gain';
    case 'transfer':
      return 'transfer';
    case 'purchase':
      return 'buy';
    default:
      return '';
  }
}
