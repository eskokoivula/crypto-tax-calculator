import CryptoJS from 'crypto-js';
import type { ParsedTransaction } from '../types';

const BASE_URL = 'https://api.bybit.com';
const RECV_WINDOW = '20000';

function signRequest(timestamp: string, apiKey: string, recvWindow: string, queryString: string, secret: string): string {
  const preSign = timestamp + apiKey + recvWindow + queryString;
  return CryptoJS.HmacSHA256(preSign, secret).toString(CryptoJS.enc.Hex);
}

async function fetchBybit<T>(path: string, params: Record<string, string>, apiKey: string, secret: string): Promise<T> {
  const timestamp = Date.now().toString();
  const queryString = new URLSearchParams(params).toString();
  const sign = signRequest(timestamp, apiKey, RECV_WINDOW, queryString, secret);

  const url = `${BASE_URL}${path}${queryString ? '?' + queryString : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-SIGN': sign,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Bybit API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retCode} - ${data.retMsg || 'Unknown error'}`);
  }

  return data.result as T;
}

interface BybitTrade {
  symbol: string;
  orderId: string;
  side: 'Buy' | 'Sell';
  orderPrice: string;
  orderQty: string;
  execPrice: string;
  execQty: string;
  execFee: string;
  feeCurrency: string;
  execTime: string;
}

interface BybitTradeResult {
  list: BybitTrade[];
  nextPageCursor: string;
}

interface BybitDeposit {
  coin: string;
  amount: string;
  status: number;
  successAt: string;
  txID: string;
}

interface BybitDepositResult {
  rows: BybitDeposit[];
  nextPageCursor: string;
}

interface BybitWithdrawal {
  coin: string;
  amount: string;
  status: string;
  createTime: string;
  txID: string;
  withdrawFee: string;
}

interface BybitWithdrawalResult {
  rows: BybitWithdrawal[];
  nextPageCursor: string;
}

const KNOWN_QUOTE_TOKENS = ['USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'USD'];

function splitSymbol(symbol: string): { base: string; quote: string } {
  const sorted = [...KNOWN_QUOTE_TOKENS].sort((a, b) => b.length - a.length);
  for (const quote of sorted) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return { base: symbol, quote: 'USDT' };
}

export async function getBybitTradeHistory(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const result = await fetchBybit<BybitTradeResult>(
    '/v5/execution/list',
    { category: 'spot', limit: '100' },
    apiKey,
    secret,
  );

  const trades = result.list || [];

  return trades.map((trade) => {
    const { base, quote } = splitSymbol(trade.symbol);
    const price = parseFloat(trade.execPrice);
    const qty = parseFloat(trade.execQty);
    const fee = parseFloat(trade.execFee);

    return {
      date: new Date(parseInt(trade.execTime, 10)),
      type: trade.side === 'Buy' ? 'buy' as const : 'sell' as const,
      tokenSymbol: base,
      amount: Math.abs(qty),
      counterTokenSymbol: quote,
      counterAmount: Math.abs(qty * price),
      feeAmount: !isNaN(fee) ? Math.abs(fee) : undefined,
      feeCurrency: trade.feeCurrency || undefined,
      priceUsd: quote === 'USDT' || quote === 'USDC' ? price : undefined,
      rawRow: trade as unknown as Record<string, string>,
    };
  });
}

export async function getBybitDeposits(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const result = await fetchBybit<BybitDepositResult>(
    '/v5/asset/deposit/query-record',
    { limit: '50' },
    apiKey,
    secret,
  );

  const deposits = result.rows || [];

  return deposits
    .filter((d) => d.status === 3) // 3 = success
    .map((d) => ({
      date: new Date(d.successAt),
      type: 'deposit' as const,
      tokenSymbol: d.coin,
      amount: parseFloat(d.amount),
      rawRow: d as unknown as Record<string, string>,
    }));
}

export async function getBybitWithdrawals(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const result = await fetchBybit<BybitWithdrawalResult>(
    '/v5/asset/withdraw/query-record',
    { limit: '50' },
    apiKey,
    secret,
  );

  const withdrawals = result.rows || [];

  return withdrawals
    .filter((w) => w.status === 'success')
    .map((w) => ({
      date: new Date(w.createTime),
      type: 'withdrawal' as const,
      tokenSymbol: w.coin,
      amount: parseFloat(w.amount),
      feeAmount: parseFloat(w.withdrawFee),
      feeCurrency: w.coin,
      rawRow: w as unknown as Record<string, string>,
    }));
}

export async function testBybitConnection(apiKey: string, secret: string): Promise<boolean> {
  try {
    await fetchBybit<unknown>(
      '/v5/account/wallet-balance',
      { accountType: 'UNIFIED' },
      apiKey,
      secret,
    );
    return true;
  } catch {
    return false;
  }
}
