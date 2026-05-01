import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalRate, getLatestRate } from '@/lib/currency';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get('date');

  try {
    let rate: number;
    let date: string;

    if (dateParam) {
      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: 'Invalid date format. Expected YYYY-MM-DD.' },
          { status: 400 },
        );
      }

      const parsed = new Date(dateParam + 'T00:00:00Z');
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date value' },
          { status: 400 },
        );
      }

      rate = await getHistoricalRate(parsed);
      date = dateParam;
    } else {
      rate = await getLatestRate();
      date = new Date().toISOString().split('T')[0];
    }

    return NextResponse.json({ rate, date });
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
