import { NextRequest, NextResponse } from 'next/server';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  const { address } = params;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid wallet address' },
      { status: 400 },
    );
  }

  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Moralis API key not configured' },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get('chain');
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
  const limit = searchParams.get('limit');
  const cursor = searchParams.get('cursor');

  if (!chain) {
    return NextResponse.json(
      { error: 'Missing required query parameter: chain' },
      { status: 400 },
    );
  }

  // Build Moralis query string
  const queryParams = new URLSearchParams({
    chain,
    include_internal_transactions: 'true',
    nft_metadata: 'true',
  });

  if (fromDate) queryParams.set('from_date', fromDate);
  if (toDate) queryParams.set('to_date', toDate);
  if (limit) queryParams.set('limit', limit);
  if (cursor) queryParams.set('cursor', cursor);

  try {
    const response = await fetch(
      `${MORALIS_BASE}/wallets/${address}/history?${queryParams.toString()}`,
      {
        headers: {
          accept: 'application/json',
          'X-API-Key': apiKey,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Moralis API error: ${response.status}`, details: errorBody },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch wallet history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
