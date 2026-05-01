import { NextResponse } from 'next/server';
import { runResolutionAgent } from '@/lib/ai/agent';
import type { AgentResolution } from '@/lib/ai/agent';

export const maxDuration = 60; // Allow up to 60s for the agent loop

interface ResolveRequestBody {
  missingItems: {
    token: string;
    amount: number;
    earliestDate: string; // ISO string from client
    tokenAddress?: string;
    chain?: string;
  }[];
  wallets: string[];
  chains: string[];
}

export async function POST(request: Request): Promise<NextResponse<AgentResolution | { error: string }>> {
  try {
    const body = (await request.json()) as ResolveRequestBody;

    // Validate required fields
    if (!body.missingItems?.length) {
      return NextResponse.json(
        { error: 'missingItems array is required and must not be empty.' },
        { status: 400 },
      );
    }

    if (!body.wallets?.length) {
      return NextResponse.json(
        { error: 'wallets array is required and must not be empty.' },
        { status: 400 },
      );
    }

    if (!body.chains?.length) {
      return NextResponse.json(
        { error: 'chains array is required and must not be empty.' },
        { status: 400 },
      );
    }

    // Convert ISO date strings to Date objects
    const missingCostBasis = body.missingItems.map((item) => ({
      token: item.token,
      amount: item.amount,
      earliestDate: new Date(item.earliestDate),
      tokenAddress: item.tokenAddress,
      chain: item.chain,
    }));

    // Validate dates
    for (const item of missingCostBasis) {
      if (isNaN(item.earliestDate.getTime())) {
        return NextResponse.json(
          { error: `Invalid date for token "${item.token}": "${item.earliestDate}"` },
          { status: 400 },
        );
      }
    }

    const result = await runResolutionAgent(
      missingCostBasis,
      body.wallets,
      body.chains,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[agent/resolve] Error:', error);

    const message =
      error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
