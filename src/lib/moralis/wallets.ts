/**
 * Wallet-related Moralis API functions.
 */

import type { ChainId } from '@/types';
import { get, getAllPages } from './client';
import type {
  MoralisActiveChainsResponse,
  MoralisHistoryResponse,
  MoralisHistoryTransaction,
  MoralisNetWorthResponse,
  MoralisProfitabilityResponse,
  MoralisProfitabilityToken,
  MoralisTokenBalance,
  MoralisTokenBalancesResponse,
  MoralisTokenTransfer,
  MoralisTokenTransfersResponse,
} from './types';

// ---------------------------------------------------------------------------
// Active Chains
// ---------------------------------------------------------------------------

/**
 * Detect which chains a wallet has been active on.
 *
 * GET /wallets/:address/chains
 */
export async function getActiveChains(address: string): Promise<ChainId[]> {
  const data = await get<MoralisActiveChainsResponse>(
    `/wallets/${address}/chains`,
  );

  return data.active_chains
    .map((c) => c.chain_id as ChainId)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Wallet History (decoded transactions)
// ---------------------------------------------------------------------------

export interface WalletHistoryOptions {
  fromDate?: string;
  toDate?: string;
  limit?: number;
  cursor?: string;
  order?: 'ASC' | 'DESC';
  includeInternalTransactions?: boolean;
}

/**
 * Get a single page of decoded wallet history.
 *
 * GET /wallets/:address/history
 */
export async function getWalletHistory(
  address: string,
  chain: ChainId,
  opts: WalletHistoryOptions = {},
): Promise<MoralisHistoryResponse> {
  return get<MoralisHistoryResponse>(`/wallets/${address}/history`, {
    chain,
    from_date: opts.fromDate,
    to_date: opts.toDate,
    limit: opts.limit?.toString(),
    cursor: opts.cursor,
    order: opts.order ?? 'DESC',
    include_internal_transactions: opts.includeInternalTransactions?.toString(),
  });
}

/**
 * Auto-paginate all decoded wallet history for a given chain and date range.
 *
 * GET /wallets/:address/history (all pages)
 */
export async function getAllWalletHistory(
  address: string,
  chain: ChainId,
  opts: { fromDate?: string; toDate?: string } = {},
): Promise<MoralisHistoryTransaction[]> {
  return getAllPages<MoralisHistoryTransaction>(
    `/wallets/${address}/history`,
    {
      chain,
      from_date: opts.fromDate,
      to_date: opts.toDate,
      order: 'ASC',
      include_internal_transactions: 'true',
    },
  );
}

// ---------------------------------------------------------------------------
// Profitability
// ---------------------------------------------------------------------------

export interface ProfitabilityOptions {
  days?: 'all' | '7' | '30' | '60' | '90';
  tokenAddresses?: string[];
}

/**
 * Get per-token profit & loss for a wallet on a single chain.
 *
 * GET /wallets/:address/profitability
 */
export async function getWalletProfitability(
  address: string,
  chain: ChainId,
  opts: ProfitabilityOptions = {},
): Promise<MoralisProfitabilityToken[]> {
  const params: Record<string, string | undefined> = {
    chain,
    days: opts.days ?? 'all',
  };

  if (opts.tokenAddresses?.length) {
    // Moralis accepts comma-separated token addresses via the query string
    params.token_addresses = opts.tokenAddresses.join(',');
  }

  const data = await get<MoralisProfitabilityResponse>(
    `/wallets/${address}/profitability`,
    params,
  );

  return data.result;
}

/**
 * Convenience wrapper that returns a summary object aggregated across all
 * tokens for a wallet on one chain.
 */
export async function getWalletProfitabilitySummary(
  address: string,
  chain: ChainId,
): Promise<{
  totalInvestedUsd: number;
  totalSoldUsd: number;
  realizedProfitUsd: number;
  tradeCount: number;
  tokens: MoralisProfitabilityToken[];
}> {
  const tokens = await getWalletProfitability(address, chain);

  let totalInvestedUsd = 0;
  let totalSoldUsd = 0;
  let realizedProfitUsd = 0;
  let tradeCount = 0;

  for (const t of tokens) {
    totalInvestedUsd += parseFloat(t.total_usd_invested) || 0;
    totalSoldUsd += parseFloat(t.total_sold_usd) || 0;
    realizedProfitUsd += parseFloat(t.realized_profit_usd) || 0;
    tradeCount += t.count_of_trades;
  }

  return { totalInvestedUsd, totalSoldUsd, realizedProfitUsd, tradeCount, tokens };
}

// ---------------------------------------------------------------------------
// Token Balances with Prices
// ---------------------------------------------------------------------------

export interface WalletBalancesOptions {
  excludeSpam?: boolean;
  excludeNative?: boolean;
  excludeUnverifiedContracts?: boolean;
  maxTokenInactivity?: number;
  minPairSideLiquidityUsd?: number;
  cursor?: string;
  limit?: number;
}

/**
 * Get ERC20 + native token balances with USD prices for a wallet on one chain.
 *
 * GET /wallets/:address/tokens
 */
export async function getWalletBalances(
  address: string,
  chain: ChainId,
  opts: WalletBalancesOptions = {},
): Promise<MoralisTokenBalance[]> {
  return getAllPages<MoralisTokenBalance>(
    `/wallets/${address}/tokens`,
    {
      chain,
      exclude_spam: (opts.excludeSpam ?? true).toString(),
      exclude_native: opts.excludeNative?.toString(),
      exclude_unverified_contracts: opts.excludeUnverifiedContracts?.toString(),
      max_token_inactivity: opts.maxTokenInactivity?.toString(),
      min_pair_side_liquidity_usd: opts.minPairSideLiquidityUsd?.toString(),
      limit: opts.limit?.toString(),
    },
  );
}

// ---------------------------------------------------------------------------
// Net Worth
// ---------------------------------------------------------------------------

/**
 * Get wallet net worth across all (or specific) chains.
 *
 * GET /wallets/:address/net-worth
 */
export async function getWalletNetWorth(
  address: string,
  opts: {
    chains?: ChainId[];
    excludeSpam?: boolean;
    excludeUnverifiedContracts?: boolean;
    maxTokenInactivity?: number;
    minPairSideLiquidityUsd?: number;
  } = {},
): Promise<MoralisNetWorthResponse> {
  const params: Record<string, string | undefined> = {
    exclude_spam: (opts.excludeSpam ?? true).toString(),
    exclude_unverified_contracts: (opts.excludeUnverifiedContracts ?? true).toString(),
  };

  if (opts.chains?.length) {
    // Moralis accepts repeated `chains` params; URLSearchParams handles this
    // but our helper uses set(), so we join with comma which Moralis also accepts.
    params.chains = opts.chains.join(',');
  }
  if (opts.maxTokenInactivity !== undefined) {
    params.max_token_inactivity = opts.maxTokenInactivity.toString();
  }
  if (opts.minPairSideLiquidityUsd !== undefined) {
    params.min_pair_side_liquidity_usd = opts.minPairSideLiquidityUsd.toString();
  }

  return get<MoralisNetWorthResponse>(
    `/wallets/${address}/net-worth`,
    params,
  );
}

// ---------------------------------------------------------------------------
// ERC20 Token Transfers
// ---------------------------------------------------------------------------

export interface TokenTransfersOptions {
  fromDate?: string;
  toDate?: string;
  fromBlock?: number;
  toBlock?: number;
  contractAddresses?: string[];
  limit?: number;
  order?: 'ASC' | 'DESC';
  cursor?: string;
}

/**
 * Get ERC20 token transfers for a wallet on one chain (single page).
 *
 * GET /:address/erc20/transfers
 *
 * Note: This endpoint uses `/:address/...` NOT `/wallets/:address/...`.
 */
export async function getWalletTokenTransfers(
  address: string,
  chain: ChainId,
  opts: TokenTransfersOptions = {},
): Promise<MoralisTokenTransfersResponse> {
  const params: Record<string, string | undefined> = {
    chain,
    order: opts.order ?? 'DESC',
    from_date: opts.fromDate,
    to_date: opts.toDate,
    from_block: opts.fromBlock?.toString(),
    to_block: opts.toBlock?.toString(),
    limit: opts.limit?.toString(),
    cursor: opts.cursor,
  };

  if (opts.contractAddresses?.length) {
    params.contract_addresses = opts.contractAddresses.join(',');
  }

  return get<MoralisTokenTransfersResponse>(
    `/${address}/erc20/transfers`,
    params,
  );
}

/**
 * Auto-paginate all ERC20 token transfers for a wallet on one chain.
 */
export async function getAllWalletTokenTransfers(
  address: string,
  chain: ChainId,
  opts: { fromDate?: string; toDate?: string } = {},
): Promise<MoralisTokenTransfer[]> {
  return getAllPages<MoralisTokenTransfer>(
    `/${address}/erc20/transfers`,
    {
      chain,
      from_date: opts.fromDate,
      to_date: opts.toDate,
      order: 'ASC',
    },
  );
}
