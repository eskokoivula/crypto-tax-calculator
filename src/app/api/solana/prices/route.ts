import { NextRequest, NextResponse } from 'next/server';

const SOLANA_BASE = 'https://solana-gateway.moralis.io';

export async function POST(request: NextRequest) {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Moralis API key not configured' },
      { status: 500 },
    );
  }

  let body: { addresses: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
    return NextResponse.json(
      { error: 'Request body must contain a non-empty addresses array' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${SOLANA_BASE}/token/mainnet/prices`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ addresses: body.addresses }),
    });

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
    console.error('Failed to fetch Solana token prices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
