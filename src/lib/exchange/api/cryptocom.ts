import CryptoJS from 'crypto-js';
import type { ParsedTransaction } from '../types';

const BASE_URL = 'https://api.crypto.com/exchange/v1';

interface CryptoComRequest {
  id: number;
  method: string;
  api_key: string;
  params: Record<string, unknown>;
  nonce: number;
  sig?: string;
}

function signRequest(request: CryptoComRequest, secret: string): string {
  const { id, method, api_key, params, nonce } = request;

  // Sort params by key
  const sortedKeys = Object.keys(params).sort();
  let paramString = '';
  for (const key of sortedKeys) {
    paramString += key + String(params[key]);
  }

  const sigPayload = method + String(id) + api_key + paramString + String(nonce);
  return CryptoJS.HmacSHA256(sigPayload, secret).toString(CryptoJS.enc.Hex);
}

async function fetchCryptoCom<T>(method: string, params: Record<string, unknown>, apiKey: string, secret: string): Promise<T> {
  const nonce = Date.now();
  const id = Math.floor(Math.random() * 1000000);

  const request: CryptoComRequest = {
    id,
    method,
    api_key: apiKey,
    params,
    nonce,
  };

  request.sig = signRequest(request, secret);

  const response = await fetch(BASE_URL + '/' + method.replace(/\./g, '/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Crypto.com API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Crypto.com API error: ${data.code} - ${data.message || 'Unknown error'}`);
  }

  return data.result as T;
}

interface CryptoComTrade {
  trade_id: string;
  order_id: string;
  instrument_name: string;
  side: 'BUY' | 'SELL';
  traded_price: string;
  traded_quantity: string;
  fee_amount: string;
  fee_currency: string;
  create_time: number;
}

interface CryptoComTradeResult {
  trade_list: CryptoComTrade[];
}

export async function getCryptoComTradeHistory(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const result = await fetchCryptoCom<CryptoComTradeResult>(
    'private/get-trades',
    {},
    apiKey,
    secret,
  );

  const trades = result.trade_list || [];

  return trades.map((trade) => {
    // Instrument name like "BTC_USDT"
    const [base, quote] = trade.instrument_name.split('_');
    const price = parseFloat(trade.traded_price);
    const qty = parseFloat(trade.traded_quantity);

    return {
      date: new Date(trade.create_time),
      type: trade.side === 'BUY' ? 'buy' as const : 'sell' as const,
      tokenSymbol: base,
      amount: Math.abs(qty),
      counterTokenSymbol: quote,
      counterAmount: Math.abs(qty * price),
      feeAmount: parseFloat(trade.fee_amount),
      feeCurrency: trade.fee_currency,
      priceUsd: quote === 'USDT' || quote === 'USD' ? price : undefined,
      rawRow: trade as unknown as Record<string, string>,
    };
  });
}

export async function testCryptoComConnection(apiKey: string, secret: string): Promise<boolean> {
  try {
    await fetchCryptoCom<unknown>(
      'private/get-account-summary',
      {},
      apiKey,
      secret,
    );
    return true;
  } catch {
    return false;
  }
}
