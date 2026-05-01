import { NextRequest, NextResponse } from 'next/server';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';

export async function GET(
  _request: NextRequest,
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

  try {
    const response = await fetch(
      `${MORALIS_BASE}/wallets/${address}/chains`,
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
    console.error('Failed to fetch active chains:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
