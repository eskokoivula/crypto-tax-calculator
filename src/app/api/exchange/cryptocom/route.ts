import { NextResponse } from 'next/server';
import {
  testCryptoComConnection,
  getCryptoComTradeHistory,
} from '@/lib/exchange/api/cryptocom';

interface RequestBody {
  apiKey: string;
  secret: string;
  action: 'test' | 'trades';
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
        const connected = await testCryptoComConnection(apiKey, secret);
        return NextResponse.json({ connected });
      }

      case 'trades': {
        const trades = await getCryptoComTradeHistory(apiKey, secret);
        return NextResponse.json({
          transactions: trades.map((t) => ({
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
