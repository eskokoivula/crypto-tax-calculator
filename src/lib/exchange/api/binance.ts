import CryptoJS from 'crypto-js';
import type { ParsedTransaction } from '../types';

const BASE_URL = 'https://api.binance.com';

function signRequest(queryString: string, secret: string): string {
  return CryptoJS.HmacSHA256(queryString, secret).toString();
}

function buildSignedUrl(path: string, params: Record<string, string>, apiKey: string, secret: string): { url: string; headers: Record<string, string> } {
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = signRequest(queryString, secret);

  return {
    url: `${BASE_URL}${path}?${queryString}&signature=${signature}`,
    headers: {
      'X-MBX-APIKEY': apiKey,
    },
  };
}

async function fetchBinance<T>(path: string, params: Record<string, string>, apiKey: string, secret: string): Promise<T> {
  const { url, headers } = buildSignedUrl(path, params, apiKey, secret);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: response.statusText }));
    throw new Error(`Binance API error: ${error.msg || response.statusText} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

interface BinanceDeposit {
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  txId: string;
  insertTime: number;
}

interface BinanceWithdrawal {
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  txId: string;
  applyTime: string;
  transactionFee: string;
}

export async function getBinanceTradeHistory(
  apiKey: string,
  secret: string,
  symbol?: string,
): Promise<ParsedTransaction[]> {
  // Binance requires a symbol for myTrades - we fetch common pairs
  const symbols = symbol ? [symbol] : ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'XRPUSDT'];
  const allTrades: ParsedTransaction[] = [];

  for (const sym of symbols) {
    try {
      const trades = await fetchBinance<BinanceTrade[]>(
        '/api/v3/myTrades',
        { symbol: sym, limit: '1000' },
        apiKey,
        secret,
      );

      for (const trade of trades) {
        const base = sym.replace(/USDT$|BUSD$|BTC$|ETH$|BNB$/, '');
        const quote = sym.slice(base.length);

        allTrades.push({
          date: new Date(trade.time),
          type: trade.isBuyer ? 'buy' : 'sell',
          tokenSymbol: base,
          amount: Math.abs(parseFloat(trade.qty)),
          counterTokenSymbol: quote,
          counterAmount: Math.abs(parseFloat(trade.quoteQty)),
          feeAmount: parseFloat(trade.commission),
          feeCurrency: trade.commissionAsset,
          priceUsd: quote === 'USDT' || quote === 'BUSD' ? parseFloat(trade.price) : undefined,
          rawRow: trade as unknown as Record<string, string>,
        });
      }
    } catch {
      // Symbol may not have trades or may not exist - continue
    }
  }

  return allTrades;
}

export async function getBinanceDeposits(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const deposits = await fetchBinance<BinanceDeposit[]>(
    '/sapi/v1/capital/deposit/hisrec',
    { limit: '1000' },
    apiKey,
    secret,
  );

  return deposits
    .filter((d) => d.status === 1) // 1 = success
    .map((d) => ({
      date: new Date(d.insertTime),
      type: 'deposit' as const,
      tokenSymbol: d.coin,
      amount: parseFloat(d.amount),
      rawRow: d as unknown as Record<string, string>,
    }));
}

export async function getBinanceWithdrawals(apiKey: string, secret: string): Promise<ParsedTransaction[]> {
  const withdrawals = await fetchBinance<BinanceWithdrawal[]>(
    '/sapi/v1/capital/withdraw/history',
    { limit: '1000' },
    apiKey,
    secret,
  );

  return withdrawals
    .filter((w) => w.status === 6) // 6 = completed
    .map((w) => ({
      date: new Date(w.applyTime),
      type: 'withdrawal' as const,
      tokenSymbol: w.coin,
      amount: parseFloat(w.amount),
      feeAmount: parseFloat(w.transactionFee),
      feeCurrency: w.coin,
      rawRow: w as unknown as Record<string, string>,
    }));
}

export async function testBinanceConnection(apiKey: string, secret: string): Promise<boolean> {
  try {
    await fetchBinance<{ balances: unknown[] }>(
      '/api/v3/account',
      {},
      apiKey,
      secret,
    );
    return true;
  } catch {
    return false;
  }
}
