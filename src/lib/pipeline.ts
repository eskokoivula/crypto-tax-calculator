/**
 * Main data pipeline orchestrator.
 *
 * Runs CLIENT-SIDE: fetches from our Next.js API routes (not Moralis directly)
 * and orchestrates the full flow from wallet scanning to tax computation.
 */

import type {
  ChainId,
  TokenBalance,
  Transaction,
  Wallet,
  Warning,
} from '@/types';
import { CHAIN_NAMES, PROFITABILITY_CHAINS } from '@/types';
import { generateId, getTaxYearRange, weiToEth } from '@/lib/utils';
import { categorizeTransaction, isInternalTransfer } from '@/lib/tax/categorize';
import { deduplicateTransactions } from '@/lib/tax/dedup';
import { FIFOEngine } from '@/lib/tax/fifo';
import { calculateGain } from '@/lib/tax/gains';
import { generateWarnings } from '@/lib/notifications';
import type {
  MoralisActiveChainsResponse,
  MoralisHistoryResponse,
  MoralisHistoryTransaction,
  MoralisHistoryErc20Transfer,
  MoralisHistoryNativeTransfer,
} from '@/lib/moralis/types';

// ---------------------------------------------------------------------------
// Fixed set of major EVM chains to ALWAYS scan for balances (BUG 1)
// ---------------------------------------------------------------------------

const BALANCE_CHAINS: ChainId[] = [
  '0x1', '0x89', '0x2105', '0x38', '0xa4b1', '0xa', '0xa86a',
];

// ---------------------------------------------------------------------------
// Spam detection
// ---------------------------------------------------------------------------

const SPAM_URL_PATTERNS = /\.(com|net|org|io)|https?:\/\/|www\./i;
const SPAM_KEYWORD_PATTERNS = /visit\s*website|claim|reward|airdrop/i;

export function isSpamToken(name: string, symbol: string): boolean {
  if (!name && !symbol) return false;
  if (name && SPAM_URL_PATTERNS.test(name)) return true;
  if (name && SPAM_KEYWORD_PATTERNS.test(name)) return true;
  if (name && name.length > 50) return true;
  if (symbol && symbol.length > 10) return true;
  return false;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function fetchApi<T = unknown>(
  url: string,
  params?: Record<string, string>,
): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();
  const fullUrl = query ? `${url}?${query}` : url;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `API error ${response.status}: ${body || response.statusText}`,
    );
  }
  return response.json();
}

async function postApi<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `API error ${response.status}: ${text || response.statusText}`,
    );
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Auto-paginate wallet history via our API route
// ---------------------------------------------------------------------------

async function fetchAllHistory(
  address: string,
  chain: ChainId,
  fromDate: string,
  toDate: string,
): Promise<MoralisHistoryTransaction[]> {
  const allItems: MoralisHistoryTransaction[] = [];
  let cursor: string | null = null;

  do {
    const params: Record<string, string> = {
      chain,
      from_date: fromDate,
      to_date: toDate,
    };
    if (cursor) params.cursor = cursor;

    const page = await fetchApi<MoralisHistoryResponse>(
      `/api/wallets/${address}/history`,
      params,
    );

    if (page.result) {
      allItems.push(...page.result);
    }
    cursor = page.cursor ?? null;
  } while (cursor);

  return allItems;
}

// ---------------------------------------------------------------------------
// Fetch token balances for a wallet+chain via our API route (BUG 2: paginated)
// ---------------------------------------------------------------------------

interface MoralisBalanceToken {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted: string;
  usd_price: string | number | null; // Moralis returns string
  logo: string | null;
  decimals: number;
  token_address: string;
}

interface MoralisBalanceResponse {
  result?: MoralisBalanceToken[];
  cursor?: string | null;
}

async function fetchBalances(
  address: string,
  chain: ChainId,
): Promise<TokenBalance[]> {
  const allTokens: TokenBalance[] = [];
  let cursor: string | null = null;

  try {
    do {
      const params: Record<string, string> = { chain };
      if (cursor) params.cursor = cursor;

      const data = await fetchApi<MoralisBalanceToken[] | MoralisBalanceResponse>(
        `/api/wallets/${address}/balances`,
        params,
      );

      // The Moralis endpoint may return { result: [...], cursor: ... } or a direct array
      const tokens: MoralisBalanceToken[] = Array.isArray(data)
        ? data
        : (data as MoralisBalanceResponse).result ?? [];

      for (const t of tokens) {
        allTokens.push({
          tokenAddress: (t.token_address || '').toLowerCase(),
          symbol: t.symbol || '???',
          name: t.name || 'Unknown',
          logo: t.logo ?? undefined,
          balance: t.balance || '0',
          balanceFormatted: parseFloat(t.balance_formatted || '0'),
          decimals: t.decimals ?? 18,
          usdPrice: t.usd_price != null ? parseFloat(String(t.usd_price)) || 0 : 0,
          eurValue: 0, // computed later
          portfolioPercentage: 0,
          chain,
          walletAddress: address.toLowerCase(),
        });
      }

      cursor = Array.isArray(data) ? null : (data as MoralisBalanceResponse).cursor ?? null;
    } while (cursor);
  } catch (err) {
    console.warn(`Failed to fetch balances for ${address} on ${chain}:`, err);
  }

  return allTokens;
}

// ---------------------------------------------------------------------------
// Batch fetch token prices per chain
// ---------------------------------------------------------------------------

interface PriceResult {
  tokenAddress: string;
  usdPrice: number;
}

async function fetchTokenPricesBatch(
  tokens: { token_address: string; chain: ChainId }[],
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (tokens.length === 0) return priceMap;

  // Group tokens by chain — the Moralis POST /erc20/prices endpoint is per-chain
  const byChain = new Map<ChainId, string[]>();
  for (const t of tokens) {
    const list = byChain.get(t.chain) ?? [];
    list.push(t.token_address);
    byChain.set(t.chain, list);
  }

  for (const [chain, addresses] of Array.from(byChain.entries())) {
    // Skip non-EVM chains
    if (chain === 'solana') continue;

    // Deduplicate addresses within a chain
    const unique = Array.from(new Set(addresses));

    // Moralis accepts up to 25 tokens per request
    const BATCH_SIZE = 25;
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const payload = {
        tokens: batch.map((addr) => ({ token_address: addr, chain })),
      };

      try {
        const results = await postApi<PriceResult[]>(
          '/api/tokens/price',
          payload,
        );

        const priceArr: PriceResult[] = Array.isArray(results)
          ? results
          : (results as unknown as { result?: PriceResult[] }).result ?? [];

        for (const r of priceArr) {
          if (r.tokenAddress && r.usdPrice != null) {
            priceMap.set(
              `${chain}-${r.tokenAddress.toLowerCase()}`,
              r.usdPrice,
            );
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch prices for chain ${chain} batch:`, err);
      }
    }
  }

  return priceMap;
}

// ---------------------------------------------------------------------------
// EUR rate helpers (BUG 3: simplified to use single rate from /api/eur-rate)
// ---------------------------------------------------------------------------

/**
 * Get the EUR rate for a given date string from the rates map.
 * Falls back to any available rate, then to a hardcoded fallback.
 */
function getEurRateForDate(
  dateStr: string,
  eurRates: Map<string, number>,
): number {
  // Try exact date
  const dateKey = dateStr.slice(0, 10); // YYYY-MM-DD
  const exact = eurRates.get(dateKey);
  if (exact !== undefined) return exact;

  // Return any available rate (we may only have a single "latest" rate)
  const rates = Array.from(eurRates.values());
  return rates.length > 0 ? rates[0] : 0.87;
}

// ---------------------------------------------------------------------------
// Transform Moralis history into Transaction[]
// ---------------------------------------------------------------------------

export function transformMoralisHistory(
  historyItems: MoralisHistoryTransaction[],
  walletAddress: string,
  chain: ChainId,
  eurRates: Map<string, number>,
  userWallets: string[],
): Transaction[] {
  const transactions: Transaction[] = [];
  const normalizedWallets = userWallets.map((w) => w.toLowerCase());

  for (const item of historyItems) {
    // Skip failed transactions (Moralis returns as number or string)
    if (String(item.receipt_status) === '0') continue;

    // Skip spam (Moralis returns as boolean or string)
    if (item.possible_spam === true || item.possible_spam === 'true') continue;

    const timestamp = item.block_timestamp;
    const date = new Date(timestamp);
    const eurRate = getEurRateForDate(timestamp, eurRates);

    // Calculate gas fee in EUR
    const gasUsed = BigInt(item.receipt_gas_used || '0');
    const gasPrice = BigInt(item.gas_price || '0');
    const gasCostWei = gasUsed * gasPrice;
    const gasCostEth = Number(gasCostWei) / 1e18;
    // We approximate ETH price from the transaction_fee field or use a rough estimate
    // transaction_fee is in USD from Moralis
    const txFeeUsd = parseFloat(item.transaction_fee) || 0;
    const gasFeeEur = txFeeUsd * eurRate;

    const category = categorizeTransaction(item, normalizedWallets);
    const isInternal = isInternalTransfer(
      item.from_address || '',
      item.to_address || '',
      normalizedWallets,
    );

    // Process ERC20 transfers
    const erc20Transfers = item.erc20_transfers ?? [];
    for (const transfer of erc20Transfers) {
      if (transfer.possible_spam === true || transfer.possible_spam === 'true') continue;

      // Bug 4: Spam token filter
      if (isSpamToken(transfer.token_name || '', transfer.token_symbol || '')) continue;

      const valueFormatted = parseFloat(transfer.value_formatted || '0');
      if (valueFormatted === 0) continue;

      // Determine direction
      const isSend = normalizedWallets.includes(
        transfer.from_address?.toLowerCase() ?? '',
      );
      const isReceive = normalizedWallets.includes(
        transfer.to_address?.toLowerCase() ?? '',
      );

      if (!isSend && !isReceive) continue;

      // For ERC20 we don't have a direct USD value from the history item,
      // so we estimate from the amount (this is a simplification; real USD
      // value would need a price lookup). We'll use 0 and let FIFO handle it.
      const tx: Transaction = {
        id: `${item.hash}-erc20-${transfer.log_index}`,
        txHash: item.hash,
        blockNumber: parseInt(item.block_number, 10) || 0,
        timestamp,
        date,
        chain,
        walletAddress: walletAddress.toLowerCase(),
        from: (transfer.from_address || '').toLowerCase(),
        to: (transfer.to_address || '').toLowerCase(),
        tokenName: transfer.token_name || 'Unknown',
        tokenSymbol: transfer.token_symbol || '???',
        tokenAddress: (transfer.address || '').toLowerCase(),
        amount: String(transfer.value),
        amountFormatted: valueFormatted,
        valueUsd: 0,
        valueEur: 0,
        gasFeeEur: isSend ? gasFeeEur : 0, // Gas paid by sender
        exchangeFeeEur: 0,
        category,
        source: 'onchain',
        summary: item.summary || undefined,
        warnings: [],
        isInternalTransfer: isInternal,
        dismissed: false,
      };

      transactions.push(tx);
    }

    // Process native transfers
    const nativeTransfers = item.native_transfers ?? [];
    for (let i = 0; i < nativeTransfers.length; i++) {
      const transfer = nativeTransfers[i];
      const valueFormatted = parseFloat(transfer.value_formatted || '0');
      if (valueFormatted === 0) continue;

      const isSend =
        transfer.direction === 'send' ||
        normalizedWallets.includes(
          transfer.from_address?.toLowerCase() ?? '',
        );
      const isReceive =
        transfer.direction === 'receive' ||
        normalizedWallets.includes(
          transfer.to_address?.toLowerCase() ?? '',
        );

      if (!isSend && !isReceive) continue;

      const tx: Transaction = {
        id: `${item.hash}-native-${i}`,
        txHash: item.hash,
        blockNumber: parseInt(item.block_number, 10) || 0,
        timestamp,
        date,
        chain,
        walletAddress: walletAddress.toLowerCase(),
        from: (transfer.from_address || '').toLowerCase(),
        to: (transfer.to_address || '').toLowerCase(),
        tokenName: transfer.token_symbol || CHAIN_NAMES[chain] || 'Native',
        tokenSymbol: transfer.token_symbol || 'ETH',
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: transfer.value,
        amountFormatted: valueFormatted,
        valueUsd: 0,
        valueEur: 0,
        gasFeeEur: isSend ? gasFeeEur : 0,
        exchangeFeeEur: 0,
        category,
        source: 'onchain',
        summary: item.summary || undefined,
        warnings: [],
        isInternalTransfer: isInternal,
        dismissed: false,
      };

      transactions.push(tx);
    }

    // If there were no ERC20 or native transfers but there was a value transfer
    // at the transaction level (e.g., simple ETH send)
    if (erc20Transfers.length === 0 && nativeTransfers.length === 0) {
      const value = BigInt(item.value || '0');
      if (value > BigInt(0)) {
        const valueEth = Number(value) / 1e18;

        const tx: Transaction = {
          id: `${item.hash}-tx-0`,
          txHash: item.hash,
          blockNumber: parseInt(item.block_number, 10) || 0,
          timestamp,
          date,
          chain,
          walletAddress: walletAddress.toLowerCase(),
          from: (item.from_address || '').toLowerCase(),
          to: (item.to_address || '').toLowerCase(),
          tokenName: 'Ether',
          tokenSymbol: 'ETH',
          tokenAddress: '0x0000000000000000000000000000000000000000',
          amount: item.value,
          amountFormatted: valueEth,
          valueUsd: 0,
          valueEur: 0,
          gasFeeEur,
          exchangeFeeEur: 0,
          category,
          source: 'onchain',
          summary: item.summary || undefined,
          warnings: [],
          isInternalTransfer: isInternal,
          dismissed: false,
        };

        transactions.push(tx);
      }
    }
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Transform Solana portfolio into Transaction[] and TokenBalance[]
// ---------------------------------------------------------------------------

interface SolanaPortfolioToken {
  associatedTokenAddress: string;
  mint: string;
  name: string;
  symbol: string;
  amount: string;
  amountRaw: string;
  decimals: number;
  logo?: string;
  possibleSpam?: boolean;
  usdPrice?: number;
  usdValue?: number;
}

interface SolanaPortfolio {
  nativeBalance: {
    lamports: string;
    solana: string;
  };
  tokens: SolanaPortfolioToken[];
  nfts?: unknown[];
}

function transformSolanaPortfolio(
  portfolio: SolanaPortfolio,
  walletAddress: string,
): { transactions: Transaction[]; balances: TokenBalance[] } {
  const balances: TokenBalance[] = [];
  const transactions: Transaction[] = [];

  // Native SOL balance
  const solBalance = parseFloat(portfolio.nativeBalance?.solana || '0');
  if (solBalance > 0) {
    balances.push({
      tokenAddress: 'So11111111111111111111111111111111111111112', // Wrapped SOL mint
      symbol: 'SOL',
      name: 'Solana',
      balance: portfolio.nativeBalance.lamports || '0',
      balanceFormatted: solBalance,
      decimals: 9,
      usdPrice: 0, // Will be enriched by Solana price fetch
      eurValue: 0,
      portfolioPercentage: 0,
      chain: 'solana',
      walletAddress, // Keep original case for Solana
    });
  }

  // SPL tokens
  for (const token of portfolio.tokens ?? []) {
    if (token.possibleSpam) continue;
    if (isSpamToken(token.name || '', token.symbol || '')) continue;

    const amount = parseFloat(token.amount || '0');
    if (amount <= 0) continue;

    // BUG 5: Use price data from portfolio if available
    const usdPrice = typeof token.usdPrice === 'number' && token.usdPrice > 0
      ? token.usdPrice
      : 0;

    balances.push({
      tokenAddress: token.mint || '',
      symbol: token.symbol || '???',
      name: token.name || 'Unknown',
      logo: token.logo,
      balance: token.amountRaw || '0',
      balanceFormatted: amount,
      decimals: token.decimals ?? 0,
      usdPrice, // Use portfolio price as initial value
      eurValue: 0,
      portfolioPercentage: 0,
      chain: 'solana',
      walletAddress, // Keep original case for Solana
    });
  }

  return { transactions, balances };
}

// ---------------------------------------------------------------------------
// Solana swap history types and transform
// ---------------------------------------------------------------------------

interface SolanaSwapToken {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  amount: string;
  usdPrice: number;
  usdAmount: number;
}

interface SolanaSwap {
  transactionHash: string;
  blockTimestamp: string;
  blockNumber: number;
  transactionType: 'buy' | 'sell';
  walletAddress: string;
  exchangeName?: string;
  bought?: SolanaSwapToken;
  sold?: SolanaSwapToken;
  totalValueUsd?: number;
}

interface SolanaSwapsResponse {
  result: SolanaSwap[];
  cursor?: string;
  page?: number;
  pageSize?: number;
}

async function fetchAllSolanaSwaps(
  address: string,
  fromDate: string,
  toDate: string,
): Promise<SolanaSwap[]> {
  const allSwaps: SolanaSwap[] = [];
  let cursor: string | null = null;

  do {
    const params: Record<string, string> = {
      fromDate,
      toDate,
    };
    if (cursor) params.cursor = cursor;

    const page = await fetchApi<SolanaSwapsResponse>(
      `/api/solana/${address}/swaps`,
      params,
    );

    if (page.result) {
      allSwaps.push(...page.result);
    }
    cursor = page.cursor ?? null;
  } while (cursor);

  return allSwaps;
}

function transformSolanaSwaps(
  swaps: SolanaSwap[],
  walletAddress: string,
  eurRates: Map<string, number>,
): Transaction[] {
  const transactions: Transaction[] = [];

  for (const swap of swaps) {
    const timestamp = swap.blockTimestamp;
    const date = new Date(timestamp);
    const eurRate = getEurRateForDate(timestamp, eurRates);

    // Process the "bought" side (token received)
    if (swap.bought && parseFloat(swap.bought.amount || '0') > 0) {
      const amount = parseFloat(swap.bought.amount);
      const valueUsd = Math.abs(swap.bought.usdAmount || 0);

      transactions.push({
        id: `${swap.transactionHash}-sol-buy`,
        txHash: swap.transactionHash,
        blockNumber: swap.blockNumber || 0,
        timestamp,
        date,
        chain: 'solana',
        walletAddress,
        from: swap.sold?.address || '',
        to: swap.bought.address || '',
        tokenName: swap.bought.name || 'Unknown',
        tokenSymbol: swap.bought.symbol || '???',
        tokenAddress: swap.bought.address || '',
        amount: swap.bought.amount,
        amountFormatted: amount,
        valueUsd,
        valueEur: valueUsd * eurRate,
        gasFeeEur: 0,
        exchangeFeeEur: 0,
        category: 'purchase',
        source: 'onchain',
        summary: `Bought ${amount} ${swap.bought.symbol} on ${swap.exchangeName || 'Solana DEX'}`,
        warnings: [],
        isInternalTransfer: false,
        dismissed: false,
      });
    }

    // Process the "sold" side (token sent)
    if (swap.sold && parseFloat(swap.sold.amount || '0') > 0) {
      const amount = parseFloat(swap.sold.amount);
      const valueUsd = Math.abs(swap.sold.usdAmount || 0);

      transactions.push({
        id: `${swap.transactionHash}-sol-sell`,
        txHash: swap.transactionHash,
        blockNumber: swap.blockNumber || 0,
        timestamp,
        date,
        chain: 'solana',
        walletAddress,
        from: swap.sold.address || '',
        to: swap.bought?.address || '',
        tokenName: swap.sold.name || 'Unknown',
        tokenSymbol: swap.sold.symbol || '???',
        tokenAddress: swap.sold.address || '',
        amount: swap.sold.amount,
        amountFormatted: amount,
        valueUsd,
        valueEur: valueUsd * eurRate,
        gasFeeEur: 0,
        exchangeFeeEur: 0,
        category: 'disposal',
        source: 'onchain',
        summary: `Sold ${amount} ${swap.sold.symbol} on ${swap.exchangeName || 'Solana DEX'}`,
        warnings: [],
        isInternalTransfer: false,
        dismissed: false,
      });
    }
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Fetch Solana token prices (batch)
// ---------------------------------------------------------------------------

async function fetchSolanaTokenPrices(
  mintAddresses: string[],
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (mintAddresses.length === 0) return priceMap;

  const BATCH_SIZE = 25;
  for (let i = 0; i < mintAddresses.length; i += BATCH_SIZE) {
    const batch = mintAddresses.slice(i, i + BATCH_SIZE);
    try {
      const results = await postApi<Array<{
        tokenAddress?: string;
        address?: string;
        usdPrice?: number;
      }>>('/api/solana/prices', { addresses: batch });

      const priceArr = Array.isArray(results) ? results : [];
      for (const r of priceArr) {
        const addr = r.tokenAddress || r.address || '';
        const price = typeof r.usdPrice === 'number' ? r.usdPrice : parseFloat(String(r.usdPrice || '0'));
        if (addr && price > 0) {
          priceMap.set(addr, price);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Solana token prices:', err);
    }
  }
  return priceMap;
}

// ---------------------------------------------------------------------------
// Pipeline progress callback type
// ---------------------------------------------------------------------------

export interface PipelineProgress {
  currentWallet: string;
  currentChain: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Wrapped native token addresses for price lookups
// ---------------------------------------------------------------------------

const WRAPPED_NATIVE: Record<string, string> = {
  '0x1': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0x89': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
  '0x38': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  '0xa4b1': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH (Arbitrum)
  '0xa': '0x4200000000000000000000000000000000000006', // WETH (Optimism)
  '0x2105': '0x4200000000000000000000000000000000000006', // WETH (Base)
  '0xa86a': '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
  '0xfa': '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', // WFTM
};

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export async function runFullPipeline(
  wallets: Wallet[],
  taxYear: number,
  onProgress: (progress: PipelineProgress) => void,
): Promise<{
  transactions: Transaction[];
  warnings: Warning[];
  balances: TokenBalance[];
  walletChains: Map<string, ChainId[]>; // BUG 6: address -> detected chains
}> {
  const { from, to } = getTaxYearRange(taxYear);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);
  const userWallets = wallets.map((w) => w.address.toLowerCase());

  // Track detected chains per wallet (BUG 6)
  const walletChains = new Map<string, ChainId[]>();

  // Step 1: Fetch EUR exchange rate (BUG 3: use /api/eur-rate instead of frankfurter.app)
  onProgress({
    currentWallet: '',
    currentChain: '',
    status: 'Fetching exchange rates...',
  });

  const eurRates = new Map<string, number>();
  try {
    const eurData = await fetchApi<{ rate: number; date?: string }>('/api/eur-rate');
    const rate = eurData.rate || 0.87;
    // Store with the date key if available, and also as 'latest'
    if (eurData.date) {
      eurRates.set(eurData.date, rate);
    }
    eurRates.set('latest', rate);
  } catch (err) {
    console.warn('Failed to fetch EUR rate, using fallback:', err);
    eurRates.set('latest', 0.87);
  }

  // Step 2: For each wallet, detect chains and fetch history + balances
  const allTransactions: Transaction[] = [];
  const allBalances: TokenBalance[] = [];

  for (const wallet of wallets) {
    // Don't lowercase Solana addresses — they are case-sensitive base58
    const address = wallet.type === 'solana' ? wallet.address : wallet.address.toLowerCase();

    // 2a. Detect active chains (for HISTORY only)
    onProgress({
      currentWallet: address,
      currentChain: '',
      status: 'Detecting active chains...',
    });

    let activeChains: ChainId[] = wallet.detectedChains.length > 0
      ? wallet.detectedChains
      : [];

    if (activeChains.length === 0 && wallet.type !== 'solana') {
      try {
        const chainsData = await fetchApi<MoralisActiveChainsResponse>(
          `/api/wallets/${address}/chains`,
        );
        activeChains = (chainsData.active_chains || [])
          .map((c) => c.chain_id as ChainId)
          .filter((id) => id in CHAIN_NAMES && id !== 'solana');

        if (activeChains.length === 0) {
          // If API returned OK but no known chains, default to Ethereum
          activeChains = ['0x1'];
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Surface the error — don't silently continue
        if (errMsg.includes('401') || errMsg.includes('invalid') || errMsg.includes('Token')) {
          throw new Error(
            `Moralis API key is invalid or expired. Please check your MORALIS_API_KEY in .env. (${errMsg})`
          );
        }
        console.warn(`Failed to detect chains for ${address}:`, err);
        activeChains = ['0x1'];
      }
    } else if (wallet.type === 'solana') {
      activeChains = ['solana'];
    }

    // Store detected chains (BUG 6)
    walletChains.set(address, activeChains);

    // 2b. For each ACTIVE chain, fetch HISTORY (transactions)
    for (const chain of activeChains) {
      const chainName = CHAIN_NAMES[chain] || chain;

      // Solana support — fetch portfolio (balances) + swap history (transactions)
      if (chain === 'solana') {
        onProgress({
          currentWallet: address,
          currentChain: 'Solana',
          status: 'Fetching Solana portfolio...',
        });

        try {
          const portfolio = await fetchApi<SolanaPortfolio>(
            `/api/solana/${wallet.address}/portfolio`,
          );
          const { balances: solBalances } =
            transformSolanaPortfolio(portfolio, wallet.address);
          allBalances.push(...solBalances);
        } catch (err) {
          console.warn(`Failed to fetch Solana portfolio for ${wallet.address}:`, err);
        }

        // Fetch Solana swap/trade history
        onProgress({
          currentWallet: address,
          currentChain: 'Solana',
          status: 'Fetching Solana transaction history...',
        });

        try {
          const swaps = await fetchAllSolanaSwaps(wallet.address, fromDate, toDate);
          onProgress({
            currentWallet: address,
            currentChain: 'Solana',
            status: `Processing ${swaps.length} Solana transactions...`,
          });
          const solTxs = transformSolanaSwaps(swaps, wallet.address, eurRates);
          allTransactions.push(...solTxs);
        } catch (err) {
          console.warn(`Failed to fetch Solana swaps for ${wallet.address}:`, err);
        }

        continue;
      }

      // EVM chain: fetch transaction history
      onProgress({
        currentWallet: address,
        currentChain: chainName,
        status: `Fetching transaction history...`,
      });

      try {
        const historyItems = await fetchAllHistory(
          address,
          chain,
          fromDate,
          toDate,
        );

        onProgress({
          currentWallet: address,
          currentChain: chainName,
          status: `Processing ${historyItems.length} transactions...`,
        });

        const txs = transformMoralisHistory(
          historyItems,
          address,
          chain,
          eurRates,
          userWallets,
        );

        allTransactions.push(...txs);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Auth errors should stop the pipeline, not silently continue
        if (errMsg.includes('401') || errMsg.includes('invalid') || errMsg.includes('Token')) {
          throw new Error(
            `Moralis API key is invalid. Please check your MORALIS_API_KEY in .env.`
          );
        }
        console.warn(
          `Failed to fetch history for ${address} on ${chainName}:`,
          err,
        );
      }
    }

    // 2c. BUG 1 FIX: Fetch BALANCES from ALL major EVM chains (not just active ones)
    if (wallet.type !== 'solana') {
      for (const chain of BALANCE_CHAINS) {
        const chainName = CHAIN_NAMES[chain] || chain;

        onProgress({
          currentWallet: address,
          currentChain: chainName,
          status: 'Fetching token balances...',
        });

        const chainBalances = await fetchBalances(address, chain);
        allBalances.push(...chainBalances);

        // Track chains where we found balances (BUG 6: enrich detected chains)
        if (chainBalances.length > 0) {
          const existing = walletChains.get(address) || [];
          if (!existing.includes(chain)) {
            walletChains.set(address, [...existing, chain]);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // BUG 4: Build a secondary price map from balances as fallback
  // -------------------------------------------------------------------------

  const balancePriceMap = new Map<string, number>();
  for (const bal of allBalances) {
    if (bal.usdPrice > 0) {
      balancePriceMap.set(`${bal.chain}-${bal.tokenAddress}`, bal.usdPrice);
    }
  }

  // -------------------------------------------------------------------------
  // Batch fetch token prices and populate valueUsd / valueEur
  // -------------------------------------------------------------------------

  onProgress({
    currentWallet: '',
    currentChain: '',
    status: 'Fetching token prices...',
  });

  // Collect unique token+chain combos from all transactions
  const tokenSet = new Map<string, { token_address: string; chain: ChainId }>();
  for (const tx of allTransactions) {
    const addr = tx.tokenAddress.toLowerCase();
    // For native tokens, use the wrapped address for price lookup
    const lookupAddr =
      addr === NATIVE_ADDRESS
        ? WRAPPED_NATIVE[tx.chain] ?? addr
        : addr;

    if (lookupAddr === NATIVE_ADDRESS) continue; // no wrapped mapping available
    const key = `${tx.chain}-${lookupAddr}`;
    if (!tokenSet.has(key)) {
      tokenSet.set(key, { token_address: lookupAddr, chain: tx.chain });
    }
  }

  const priceMap = await fetchTokenPricesBatch(
    Array.from(tokenSet.values()),
  );

  // Get a single fallback EUR rate for "now" (latest available)
  const latestEurRate = getEurRateForDate(new Date().toISOString(), eurRates);

  // Assign USD and EUR values to transactions (BUG 4: fall back to balance prices)
  for (const tx of allTransactions) {
    const addr = tx.tokenAddress.toLowerCase();
    const lookupAddr =
      addr === NATIVE_ADDRESS
        ? WRAPPED_NATIVE[tx.chain] ?? addr
        : addr;
    const key = `${tx.chain}-${lookupAddr}`;

    let priceUsd = priceMap.get(key);

    // BUG 4 FIX: Fall back to balance-derived prices if batch price lookup failed
    if (priceUsd == null || priceUsd <= 0) {
      priceUsd = balancePriceMap.get(key) ?? balancePriceMap.get(`${tx.chain}-${tx.tokenAddress}`) ?? undefined;
    }

    if (priceUsd != null && priceUsd > 0) {
      tx.valueUsd = tx.amountFormatted * priceUsd;
      const txEurRate = getEurRateForDate(tx.timestamp, eurRates);
      tx.valueEur = tx.valueUsd * txEurRate;
    }
  }

  // BUG 5: Fetch Solana token prices for Solana balances and apply them
  const solanaBalances = allBalances.filter((b) => b.chain === 'solana');
  if (solanaBalances.length > 0) {
    onProgress({
      currentWallet: '',
      currentChain: 'Solana',
      status: 'Fetching Solana token prices...',
    });

    // Only fetch prices for tokens that don't already have prices from portfolio
    const solanaMintsNeedingPrices = solanaBalances
      .filter((b) => b.usdPrice <= 0)
      .map((b) => b.tokenAddress)
      .filter(Boolean);

    // Also fetch for all mints to get the most up-to-date prices
    const allSolanaMints = solanaBalances.map((b) => b.tokenAddress).filter(Boolean);
    const uniqueSolanaMints = Array.from(new Set([...allSolanaMints]));

    const solanaPrices = await fetchSolanaTokenPrices(uniqueSolanaMints);

    for (const bal of solanaBalances) {
      const price = solanaPrices.get(bal.tokenAddress);
      if (price != null && price > 0) {
        bal.usdPrice = price;
      }
      // If still no price after fetch, the portfolio-derived price (set in
      // transformSolanaPortfolio) remains as-is
    }
  }

  // Also enrich balances with EUR values
  let totalBalanceEur = 0;
  for (const bal of allBalances) {
    const eurRate = latestEurRate;
    bal.eurValue = bal.balanceFormatted * (bal.usdPrice ?? 0) * eurRate;
    totalBalanceEur += bal.eurValue;
  }
  // Compute portfolio percentages
  if (totalBalanceEur > 0) {
    for (const bal of allBalances) {
      bal.portfolioPercentage = (bal.eurValue / totalBalanceEur) * 100;
    }
  }

  // Step 3: Deduplicate
  onProgress({
    currentWallet: '',
    currentChain: '',
    status: 'Deduplicating transactions...',
  });

  const deduped = deduplicateTransactions(allTransactions, userWallets);

  // Sort by date ascending for FIFO processing
  deduped.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Step 4: Run FIFO engine
  onProgress({
    currentWallet: '',
    currentChain: '',
    status: 'Computing cost basis (FIFO)...',
  });

  const fifo = new FIFOEngine();

  for (const tx of deduped) {
    const effectiveCategory = tx.categoryOverride ?? tx.category;

    if (effectiveCategory === 'purchase' || effectiveCategory === 'income') {
      // Add acquisition lot
      fifo.addLot({
        token: tx.tokenSymbol,
        amount: tx.amountFormatted,
        costEurPerUnit:
          tx.amountFormatted > 0 ? tx.valueEur / tx.amountFormatted : 0,
        totalCostEur: tx.valueEur + tx.gasFeeEur,
        acquisitionDate: new Date(tx.timestamp),
        source: tx.source,
        txHash: tx.txHash || undefined,
      });
    } else if (effectiveCategory === 'disposal') {
      // Consume from FIFO
      const result = fifo.consume(
        tx.tokenSymbol,
        tx.amountFormatted,
        new Date(tx.timestamp),
      );

      if (result) {
        tx.costBasisEur = result.costBasisEur;

        // Step 5: Calculate gains (actual vs hankintameno-olettama)
        const gainResult = calculateGain(
          tx.valueEur,
          result.costBasisEur,
          tx.gasFeeEur + tx.exchangeFeeEur + result.feesEur,
          result.holdingPeriodDays,
        );

        tx.gainLossEur = gainResult.finalGain;
        tx.usedDeemedCost = gainResult.useDeemedCost;
      }
    }
  }

  // Step 6: Generate warnings
  onProgress({
    currentWallet: '',
    currentChain: '',
    status: 'Generating warnings...',
  });

  const warnings = generateWarnings(deduped, fifo);

  return {
    transactions: deduped,
    warnings,
    balances: allBalances,
    walletChains, // BUG 6: return detected chains
  };
}
