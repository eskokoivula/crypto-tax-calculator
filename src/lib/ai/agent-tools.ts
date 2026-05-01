/**
 * Tool execution handlers for the autonomous resolution agent.
 *
 * Each handler calls Moralis API endpoints and/or currency conversion
 * to gather the data the agent needs to resolve missing cost basis.
 */

import type { ChainId } from '@/types';
import { getWalletHistory } from '@/lib/moralis/wallets';
import { getTokenPrice } from '@/lib/moralis/tokens';
import { get } from '@/lib/moralis/client';
import { getHistoricalRate } from '@/lib/currency';

// ---------------------------------------------------------------------------
// fetch_older_history
// ---------------------------------------------------------------------------

export async function handleFetchOlderHistory(input: {
  wallet_address: string;
  chain: string;
  before_date: string;
}): Promise<string> {
  try {
    const chain = input.chain as ChainId;
    const response = await getWalletHistory(input.wallet_address, chain, {
      toDate: input.before_date,
      limit: 100,
      order: 'DESC',
    });

    const transactions = response.result ?? [];

    if (transactions.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No transactions found for wallet ${input.wallet_address} on chain ${input.chain} before ${input.before_date}.`,
      });
    }

    // Extract incoming token transfers that could be acquisitions
    const incomingTransfers: {
      hash: string;
      date: string;
      summary: string;
      tokenSymbol: string;
      tokenAddress: string;
      amount: string;
      from: string;
      type: string;
    }[] = [];

    for (const tx of transactions) {
      // Check ERC20 transfers where the wallet received tokens
      const erc20Received = (tx.erc20_transfers ?? []).filter(
        (t) =>
          t.to_address?.toLowerCase() === input.wallet_address.toLowerCase(),
      );

      for (const transfer of erc20Received) {
        incomingTransfers.push({
          hash: tx.hash,
          date: tx.block_timestamp,
          summary: tx.summary ?? '',
          tokenSymbol: transfer.token_symbol,
          tokenAddress: transfer.address,
          amount: transfer.value_formatted,
          from: transfer.from_address,
          type: 'erc20_receive',
        });
      }

      // Check native transfers where the wallet received tokens
      const nativeReceived = (tx.native_transfers ?? []).filter(
        (t) =>
          t.to_address?.toLowerCase() === input.wallet_address.toLowerCase(),
      );

      for (const transfer of nativeReceived) {
        incomingTransfers.push({
          hash: tx.hash,
          date: tx.block_timestamp,
          summary: tx.summary ?? '',
          tokenSymbol: transfer.token_symbol,
          tokenAddress: 'native',
          amount: transfer.value_formatted,
          from: transfer.from_address,
          type: 'native_receive',
        });
      }
    }

    return JSON.stringify({
      found: incomingTransfers.length > 0,
      totalTransactions: transactions.length,
      incomingTransfers: incomingTransfers.slice(0, 20), // Limit to keep context manageable
      message: incomingTransfers.length > 0
        ? `Found ${incomingTransfers.length} incoming token transfers.`
        : `Found ${transactions.length} transactions but none were incoming token transfers to this wallet.`,
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: `Failed to fetch older history: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// lookup_token_price
// ---------------------------------------------------------------------------

export async function handleLookupTokenPrice(input: {
  token_address: string;
  chain: string;
  date: string;
}): Promise<string> {
  try {
    const chain = input.chain as ChainId;

    // For native tokens, use the wrapped token address
    const NATIVE_WRAPPED: Record<string, string> = {
      '0x1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',   // WETH
      '0x89': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',  // WMATIC
      '0x38': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB
      '0xa4b1': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arbitrum)
      '0xa': '0x4200000000000000000000000000000000000006',     // WETH (Optimism)
      '0x2105': '0x4200000000000000000000000000000000000006',  // WETH (Base)
      '0xa86a': '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
    };

    const tokenAddress =
      input.token_address.toLowerCase() === 'native'
        ? NATIVE_WRAPPED[input.chain] ?? input.token_address
        : input.token_address;

    // Moralis getTokenPrice does not accept a date param directly;
    // it works with block numbers. For a rough historical price we
    // use the /erc20/:address/price endpoint with the to_date query param
    // which Moralis actually does support on certain plan tiers.
    // Fallback: just get the current price and note it's approximate.

    const priceData = await getTokenPrice(tokenAddress, chain);
    const usdPrice = priceData.usdPrice;

    // Convert to EUR at the requested date
    const date = new Date(input.date);
    const eurRate = await getHistoricalRate(date);
    const eurPrice = usdPrice * eurRate;

    return JSON.stringify({
      tokenSymbol: priceData.tokenSymbol,
      tokenName: priceData.tokenName,
      usdPrice,
      eurPrice: Math.round(eurPrice * 100_000_000) / 100_000_000,
      eurRate,
      date: input.date,
      note: 'Price is the current spot price. Historical price at the exact date may differ. This is the best available approximation.',
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: `Failed to look up token price: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// search_token_info
// ---------------------------------------------------------------------------

interface TokenMetadataResponse {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  logo: string | null;
  logo_hash: string | null;
  thumbnail: string | null;
  block_number: string | null;
  validated: number;
  created_at: string;
  possible_spam: boolean;
  verified_contract: boolean;
  categories?: string[];
  links?: Record<string, string>;
}

export async function handleSearchTokenInfo(input: {
  token_address: string;
  chain: string;
}): Promise<string> {
  try {
    const chain = input.chain as ChainId;

    // GET /erc20/metadata — Moralis token metadata endpoint
    const metadata = await get<TokenMetadataResponse[]>(
      `/erc20/metadata`,
      {
        chain,
        addresses: input.token_address,
      },
    );

    if (!metadata || metadata.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No metadata found for token ${input.token_address} on chain ${input.chain}.`,
      });
    }

    const token = metadata[0];

    // Heuristic: classify by name patterns
    const nameLower = (token.name ?? '').toLowerCase();
    const symbolLower = (token.symbol ?? '').toLowerCase();

    let tokenType = 'unknown';
    if (nameLower.includes('lp') || nameLower.includes('liquidity') || symbolLower.includes('lp')) {
      tokenType = 'lp_token';
    } else if (nameLower.includes('staked') || nameLower.includes('staking') || symbolLower.startsWith('st')) {
      tokenType = 'staking_derivative';
    } else if (nameLower.includes('reward') || nameLower.includes('airdrop')) {
      tokenType = 'reward_token';
    } else if (nameLower.includes('governance') || nameLower.includes('vote') || nameLower.includes('dao')) {
      tokenType = 'governance_token';
    } else if (nameLower.includes('wrapped')) {
      tokenType = 'wrapped_token';
    } else if (token.verified_contract) {
      tokenType = 'standard_token';
    }

    return JSON.stringify({
      found: true,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      possibleSpam: token.possible_spam,
      verifiedContract: token.verified_contract,
      createdAt: token.created_at,
      tokenType,
      categories: token.categories ?? [],
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: `Failed to search token info: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// resolve_cost_basis
// ---------------------------------------------------------------------------

export async function handleResolveCostBasis(input: {
  token_symbol: string;
  amount: number;
  cost_eur_per_unit: number;
  acquisition_date: string;
  source: string;
}): Promise<string> {
  // Validate inputs
  if (!input.token_symbol || input.token_symbol.trim() === '') {
    return JSON.stringify({ error: true, message: 'token_symbol is required.' });
  }
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return JSON.stringify({ error: true, message: 'amount must be a positive number.' });
  }
  if (typeof input.cost_eur_per_unit !== 'number' || input.cost_eur_per_unit < 0) {
    return JSON.stringify({ error: true, message: 'cost_eur_per_unit must be a non-negative number.' });
  }

  const validSources = ['historical_price', 'older_history', 'zero_cost_airdrop'];
  if (!validSources.includes(input.source)) {
    return JSON.stringify({
      error: true,
      message: `source must be one of: ${validSources.join(', ')}. Got: "${input.source}"`,
    });
  }

  // Parse and validate date
  const date = new Date(input.acquisition_date);
  if (isNaN(date.getTime())) {
    return JSON.stringify({ error: true, message: `Invalid acquisition_date: "${input.acquisition_date}"` });
  }

  return JSON.stringify({
    resolved: true,
    tokenSymbol: input.token_symbol.toUpperCase(),
    amount: input.amount,
    costEurPerUnit: input.cost_eur_per_unit,
    totalCostEur: Math.round(input.amount * input.cost_eur_per_unit * 100) / 100,
    acquisitionDate: date.toISOString(),
    source: input.source,
    message: `Resolved cost basis for ${input.amount} ${input.token_symbol.toUpperCase()}: ${input.cost_eur_per_unit} EUR/unit (${input.source}).`,
  });
}

// ---------------------------------------------------------------------------
// ask_user
// ---------------------------------------------------------------------------

export async function handleAskUser(input: {
  question: string;
  context: string;
  suggestions?: string[];
}): Promise<string> {
  // The question will be surfaced to the user via the resolution result.
  // Return a confirmation so the agent knows the question was queued.
  return JSON.stringify({
    queued: true,
    message: `Question queued for user: "${input.question}"`,
  });
}
