import { NextRequest, NextResponse } from 'next/server';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';

interface TokenPriceRequest {
  token_address: string;
  chain: string;
  to_block?: number;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Moralis API key not configured' },
      { status: 500 },
    );
  }

  let body: { tokens: TokenPriceRequest[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.tokens || !Array.isArray(body.tokens) || body.tokens.length === 0) {
    return NextResponse.json(
      { error: 'Request body must contain a non-empty tokens array' },
      { status: 400 },
    );
  }

  // Validate each token entry
  for (const token of body.tokens) {
    if (!token.token_address || !token.chain) {
      return NextResponse.json(
        { error: 'Each token must have token_address and chain' },
        { status: 400 },
      );
    }
  }

  try {
    const response = await fetch(`${MORALIS_BASE}/erc20/prices`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ tokens: body.tokens }),
    });

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
    console.error('Failed to fetch token prices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
