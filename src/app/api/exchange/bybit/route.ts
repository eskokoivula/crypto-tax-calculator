import { NextResponse } from 'next/server';
import {
  testBybitConnection,
  getBybitTradeHistory,
  getBybitDeposits,
  getBybitWithdrawals,
} from '@/lib/exchange/api/bybit';

interface RequestBody {
  apiKey: string;
  secret: string;
  action: 'test' | 'trades' | 'deposits' | 'withdrawals';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { apiKey, secret, action } = body;

    if (!apiKey || !secret) {
      return NextResponse.json(
        { error: 'API key and secret are required' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'test': {
        const connected = await testBybitConnection(apiKey, secret);
        return NextResponse.json({ connected });
      }

      case 'trades': {
        const trades = await getBybitTradeHistory(apiKey, secret);
        return NextResponse.json({
          transactions: trades.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });
      }

      case 'deposits': {
        const deposits = await getBybitDeposits(apiKey, secret);
        return NextResponse.json({
          transactions: deposits.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });
      }

      case 'withdrawals': {
        const withdrawals = await getBybitWithdrawals(apiKey, secret);
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
