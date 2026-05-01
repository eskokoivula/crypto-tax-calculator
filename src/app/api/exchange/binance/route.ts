import { NextResponse } from 'next/server';
import {
  testBinanceConnection,
  getBinanceTradeHistory,
  getBinanceDeposits,
  getBinanceWithdrawals,
} from '@/lib/exchange/api/binance';

interface RequestBody {
  apiKey: string;
  secret: string;
  action: 'test' | 'trades' | 'deposits' | 'withdrawals';
  symbol?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { apiKey, secret, action, symbol } = body;

    if (!apiKey || !secret) {
      return NextResponse.json(
        { error: 'API key and secret are required' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'test': {
        const connected = await testBinanceConnection(apiKey, secret);
        return NextResponse.json({ connected });
      }

      case 'trades': {
        const trades = await getBinanceTradeHistory(apiKey, secret, symbol);
        return NextResponse.json({
          transactions: trades.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });
      }

      case 'deposits': {
        const deposits = await getBinanceDeposits(apiKey, secret);
        return NextResponse.json({
          transactions: deposits.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });
      }

      case 'withdrawals': {
        const withdrawals = await getBinanceWithdrawals(apiKey, secret);
        return NextResponse.json({
          transactions: withdrawals.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
