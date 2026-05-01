/**
 * Transaction deduplication logic.
 *
 * Handles two scenarios:
 * 1. On-chain duplicates: same txHash from multiple wallet perspectives
 * 2. Exchange-to-onchain matches: correlating exchange CSV imports with on-chain data
 */

import type { Transaction } from '@/types';

/** Tolerance for timestamp matching between exchange and on-chain records (ms). */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/** Tolerance for amount matching (percentage). */
const AMOUNT_TOLERANCE_PERCENT = 0.01; // 1%

/**
 * Deduplicate transactions from multiple sources.
 *
 * - Groups on-chain transactions by txHash; if the same hash appears from
 *   multiple wallet histories, keeps one copy and marks it as an internal transfer.
 * - For exchange imports, attempts to match against on-chain transactions by
 *   timestamp proximity + token + amount. Matched exchange records are flagged
 *   as possible duplicates via a warning.
 *
 * @param transactions - All transactions from all sources
 * @param userWallets - Normalized (lowercase) user wallet addresses
 * @returns Deduplicated transaction array
 */
export function deduplicateTransactions(
  transactions: Transaction[],
  userWallets: string[],
): Transaction[] {
  const normalizedWallets = new Set(userWallets.map((w) => w.toLowerCase()));

  // Separate on-chain vs exchange-imported transactions
  const onChain: Transaction[] = [];
  const exchangeImports: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.source === 'onchain') {
      onChain.push(tx);
    } else {
      exchangeImports.push(tx);
    }
  }

  // --- Step 1: Deduplicate on-chain by txHash ---
  const deduped = deduplicateOnChain(onChain, normalizedWallets);

  // --- Step 2: Match exchange imports against on-chain ---
  const matchedExchangeIds = new Set<string>();
  const onChainIndex = buildOnChainIndex(deduped);

  for (const exTx of exchangeImports) {
    const match = findOnChainMatch(exTx, onChainIndex);
    if (match) {
      matchedExchangeIds.add(exTx.id);
      // Add a possible-duplicate warning to the exchange transaction
      exTx.warnings = [
        ...exTx.warnings,
        {
          id: `dedup-${exTx.id}`,
          severity: 'warning',
          message: `Possible duplicate of on-chain transaction ${match.txHash}`,
          transactionId: exTx.id,
          dismissed: false,
        },
      ];
    }
  }

  // Keep exchange transactions (even matched ones, but with warning)
  return [...deduped, ...exchangeImports];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deduplicate on-chain transactions by txHash.
 * When the same txHash appears from multiple wallets, keep the first entry
 * and mark it as an internal transfer.
 */
function deduplicateOnChain(
  transactions: Transaction[],
  userWallets: Set<string>,
): Transaction[] {
  const byHash = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = tx.txHash.toLowerCase();
    const group = byHash.get(key);
    if (group) {
      group.push(tx);
    } else {
      byHash.set(key, [tx]);
    }
  }

  const result: Transaction[] = [];

  byHash.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }

    // Multiple entries for same txHash: this is likely an internal transfer
    // Keep the first entry, mark as internal
    const primary = { ...group[0] };

    // Check if both from and to are in user wallets
    const involvedAddresses = group.map((t: Transaction) => t.walletAddress.toLowerCase());
    const isInternal = involvedAddresses.every((addr) => userWallets.has(addr));

    if (isInternal) {
      primary.isInternalTransfer = true;
      primary.category = 'transfer';
    }

    result.push(primary);
  });

  return result;
}

interface OnChainIndexEntry {
  tx: Transaction;
  timestamp: number;
}

/**
 * Build an index of on-chain transactions keyed by tokenSymbol for fast lookup.
 */
function buildOnChainIndex(
  transactions: Transaction[],
): Map<string, OnChainIndexEntry[]> {
  const index = new Map<string, OnChainIndexEntry[]>();

  for (const tx of transactions) {
    const key = tx.tokenSymbol.toUpperCase();
    const entry: OnChainIndexEntry = {
      tx,
      timestamp: new Date(tx.timestamp).getTime(),
    };

    const existing = index.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(key, [entry]);
    }
  }

  return index;
}

/**
 * Try to find an on-chain transaction that matches an exchange import by:
 * - Same token symbol
 * - Timestamp within 5 minutes
 * - Amount within 1%
 */
function findOnChainMatch(
  exTx: Transaction,
  index: Map<string, OnChainIndexEntry[]>,
): Transaction | null {
  const key = exTx.tokenSymbol.toUpperCase();
  const candidates = index.get(key);
  if (!candidates) return null;

  const exTimestamp = new Date(exTx.timestamp).getTime();
  const exAmount = Math.abs(exTx.amountFormatted);

  for (const candidate of candidates) {
    // Check timestamp proximity
    const timeDiff = Math.abs(candidate.timestamp - exTimestamp);
    if (timeDiff > TIMESTAMP_TOLERANCE_MS) continue;

    // Check amount similarity
    const candidateAmount = Math.abs(candidate.tx.amountFormatted);
    if (candidateAmount === 0 && exAmount === 0) return candidate.tx;
    if (candidateAmount === 0 || exAmount === 0) continue;

    const amountDiff = Math.abs(candidateAmount - exAmount) / Math.max(candidateAmount, exAmount);
    if (amountDiff <= AMOUNT_TOLERANCE_PERCENT) {
      return candidate.tx;
    }
  }

  return null;
}
