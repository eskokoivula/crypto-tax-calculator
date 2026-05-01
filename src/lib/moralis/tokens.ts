/**
 * Token-related Moralis API functions.
 */

import type { ChainId } from '@/types';
import { get, post } from './client';
import type { MoralisTokenPrice } from './types';

// ---------------------------------------------------------------------------
// Single Token Price
// ---------------------------------------------------------------------------

/**
 * Get the current (or historical) price of a single ERC20 token.
 *
 * GET /erc20/:address/price
 *
 * @param tokenAddress - The token contract address.
 * @param chain        - Chain to query.
 * @param toBlock      - Optional block number for historical price (decimal, not hex).
 */
export async function getTokenPrice(
  tokenAddress: string,
  chain: ChainId,
  toBlock?: number,
): Promise<MoralisTokenPrice> {
  return get<MoralisTokenPrice>(`/erc20/${tokenAddress}/price`, {
    chain,
    to_block: toBlock?.toString(),
  });
}

// ---------------------------------------------------------------------------
// Multiple Token Prices (batch)
// ---------------------------------------------------------------------------

export interface BatchTokenPriceRequest {
  token_address: string;
  exchange?: string;
  to_block?: string;
}

/**
 * Get prices for multiple ERC20 tokens in a single request.
 *
 * POST /erc20/prices
 *
 * Moralis allows up to 100 tokens per request. All tokens in a single call
 * must be on the same chain (set via query param). If you need prices across
 * multiple chains, call this function once per chain.
 *
 * @param tokens - Array of token requests (max 100).
 * @param chain  - The chain all tokens belong to.
 */
export async function getMultipleTokenPrices(
  tokens: BatchTokenPriceRequest[],
  chain: ChainId,
): Promise<MoralisTokenPrice[]> {
  if (tokens.length === 0) return [];

  if (tokens.length > 100) {
    // Chunk into batches of 100 and merge results
    const results: MoralisTokenPrice[] = [];
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      const prices = await post<MoralisTokenPrice[]>(
        '/erc20/prices',
        { tokens: chunk },
        { chain },
      );
      results.push(...prices);
    }
    return results;
  }

  return post<MoralisTokenPrice[]>(
    '/erc20/prices',
    { tokens },
    { chain },
  );
}

/**
 * Convenience helper: get current prices for a list of token addresses on one chain.
 */
export async function getTokenPrices(
  tokenAddresses: string[],
  chain: ChainId,
): Promise<MoralisTokenPrice[]> {
  const tokens: BatchTokenPriceRequest[] = tokenAddresses.map((addr) => ({
    token_address: addr,
  }));
  return getMultipleTokenPrices(tokens, chain);
}

/**
 * Convenience helper: get historical prices at a specific block for a list of tokens.
 */
export async function getHistoricalTokenPrices(
  tokenAddresses: string[],
  chain: ChainId,
  toBlock: number,
): Promise<MoralisTokenPrice[]> {
  const tokens: BatchTokenPriceRequest[] = tokenAddresses.map((addr) => ({
    token_address: addr,
    to_block: toBlock.toString(),
  }));
  return getMultipleTokenPrices(tokens, chain);
}
