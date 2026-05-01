import type { ExchangeInstruction } from './types';

export const EXCHANGE_INSTRUCTIONS: Record<string, ExchangeInstruction> = {
  binance: {
    exchange: 'Binance',
    logo: '\uD83D\uDFE1',
    csvSteps: [
      'Log in to Binance (binance.com)',
      'Go to Orders \u2192 Trade History',
      'Click "Export" in the top right',
      'Select date range (full year for tax reporting)',
      'Choose "Export CSV"',
      'Wait for the file to generate and download it',
      'Also export: Wallet \u2192 Transaction History \u2192 Export for deposits/withdrawals',
    ],
    apiSteps: [
      'Log in to Binance (binance.com)',
      'Go to Account \u2192 API Management',
      'Click "Create API" and choose "System generated"',
      'Name it "CryptoTax" (or any name)',
      'Complete 2FA verification',
      'IMPORTANT: Only enable "Read" permissions \u2014 disable everything else',
      'Copy the API Key and Secret Key',
      'Paste them below and click "Test Connection"',
    ],
    apiKeyUrl: 'https://www.binance.com/en/my/settings/api-management',
    csvUrl: 'https://www.binance.com/en/my/orders/exchange/tradeorder',
    requiredPermissions: ['Enable Reading'],
    notes: [
      'API keys only need READ permission \u2014 never enable trading or withdrawal',
      'Binance may limit history to 3 months per export \u2014 export in chunks',
      'For older history, use the Tax Report tool: binance.com/en/tax',
    ],
  },
  'crypto.com': {
    exchange: 'Crypto.com',
    logo: '\uD83D\uDD35',
    csvSteps: [
      'Go to crypto.com/exchange/personal/dashboard',
      'OR use the Crypto.com Tax tool: tax.crypto.com',
      'Sign in and select the tax year',
      'Click "Export" \u2192 "Transaction History"',
      'Download the CSV file',
      'The Tax tool provides a more complete export with categories',
    ],
    apiSteps: [
      'Log in to Crypto.com Exchange (not the app)',
      'Go to Settings \u2192 API Keys',
      'Click "Create a new API Key"',
      'IMPORTANT: Select only "Read" permissions',
      'Complete 2FA verification',
      'Copy the API Key and Secret',
      'Paste them below and click "Test Connection"',
    ],
    apiKeyUrl: 'https://crypto.com/exchange/personal/api-management',
    csvUrl: 'https://tax.crypto.com',
    requiredPermissions: ['Read'],
    notes: [
      'The Crypto.com app and Exchange have separate histories',
      'For app transactions, use the Tax tool at tax.crypto.com',
      'API only covers Exchange \u2014 for full coverage, use CSV export from Tax tool',
    ],
  },
  revolut: {
    exchange: 'Revolut',
    logo: '\uD83D\uDFE3',
    csvSteps: [
      'Open the Revolut app or web (app.revolut.com)',
      'Go to Crypto section',
      'Tap "Statement" or "Account Statement"',
      'Select the date range (full year)',
      'Choose CSV format',
      'Download the file',
      'Note: Revolut crypto history may be limited \u2014 check Settings \u2192 Data Export for full history',
    ],
    apiSteps: [
      'Revolut does not offer a public crypto API for personal accounts',
      'Please use CSV export instead',
    ],
    apiKeyUrl: '',
    csvUrl: 'https://app.revolut.com',
    requiredPermissions: [],
    notes: [
      'Revolut does not have a crypto API \u2014 CSV only',
      'Make sure to export the Crypto-specific statement, not the general bank statement',
      'Revolut amounts are usually in EUR for Finnish accounts',
    ],
  },
  bybit: {
    exchange: 'Bybit',
    logo: '\uD83D\uDFE0',
    csvSteps: [
      'Log in to Bybit (bybit.com)',
      'Go to Orders \u2192 Trade History',
      'Click "Export" button',
      'Select date range',
      'Download the CSV file',
      'Also check: Assets \u2192 Transaction History for deposits/withdrawals',
    ],
    apiSteps: [
      'Log in to Bybit (bybit.com)',
      'Go to Account & Security \u2192 API Management',
      'Click "Create New Key"',
      'Select "System-generated API Keys"',
      'Name: "CryptoTax"',
      'Set permissions: Read-Only (disable trading and withdrawal)',
      'Complete 2FA verification',
      'Copy API Key and Secret Key',
      'Paste them below and click "Test Connection"',
    ],
    apiKeyUrl: 'https://www.bybit.com/app/user/api-management',
    csvUrl: 'https://www.bybit.com/user/assets/order/spot',
    requiredPermissions: ['Read-Only'],
    notes: [
      'Only enable Read-Only permissions \u2014 never enable trading',
      'Bybit V5 API is used for automatic sync',
      'History may be limited to 2 years via API',
    ],
  },
};

export const SUPPORTED_EXCHANGES = Object.keys(EXCHANGE_INSTRUCTIONS);

export function getExchangeInstruction(exchange: string): ExchangeInstruction | undefined {
  return EXCHANGE_INSTRUCTIONS[exchange.toLowerCase()];
}
