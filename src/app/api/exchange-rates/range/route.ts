import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: 'Missing required params: from, to (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${from}..${to}?from=USD&to=EUR`,
    );

    if (!response.ok) {
      // Try latest rate as fallback
      const fallback = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
      const fallbackData = await fallback.json();
      return NextResponse.json({
        rates: { [fallbackData.date]: fallbackData.rates.EUR },
      });
    }

    const data = await response.json();

    // Flatten the nested { date: { EUR: rate } } into { date: rate }
    const flatRates: Record<string, number> = {};
    if (data.rates) {
      for (const [date, currencies] of Object.entries(data.rates)) {
        const rate = (currencies as Record<string, number>).EUR;
        if (rate !== undefined) {
          flatRates[date] = rate;
        }
      }
    }

    return NextResponse.json({ rates: flatRates });
  } catch (error) {
    console.error('Failed to fetch exchange rate range:', error);
    // Return hardcoded fallback so pipeline doesn't break
    return NextResponse.json({ rates: { fallback: 0.92 } });
  }
}
