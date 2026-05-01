import { NextRequest, NextResponse } from 'next/server';

const SOLANA_BASE = 'https://solana-gateway.moralis.io';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  const { address } = params;

  if (!address || address.length < 32 || address.length > 44) {
    return NextResponse.json({ error: 'Invalid Solana address' }, { status: 400 });
  }

  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Moralis API key not configured' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const queryParams = new URLSearchParams({
    transactionTypes: 'buy,sell',
  });

  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const cursor = searchParams.get('cursor');
  const limit = searchParams.get('limit');

  if (fromDate) queryParams.set('fromDate', fromDate);
  if (toDate) queryParams.set('toDate', toDate);
  if (cursor) queryParams.set('cursor', cursor);
  if (limit) queryParams.set('limit', limit);

  try {
    const response = await fetch(
      `${SOLANA_BASE}/account/mainnet/${address}/swaps?${queryParams.toString()}`,
      {
        headers: { accept: 'application/json', 'X-API-Key': apiKey },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Moralis Solana API error: ${response.status}`, details: errorBody },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch Solana swaps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
