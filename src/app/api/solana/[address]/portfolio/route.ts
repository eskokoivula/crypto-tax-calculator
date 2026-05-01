import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  const { address } = params;

  if (!address || address.length < 32 || address.length > 44) {
    return NextResponse.json(
      { error: 'Invalid Solana address' },
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
      `https://solana-gateway.moralis.io/account/mainnet/${address}/portfolio`,
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
        { error: `Moralis Solana API error: ${response.status}`, details: errorBody },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch Solana portfolio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
