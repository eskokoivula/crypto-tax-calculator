/**
 * Auto-categorization of Moralis wallet history transactions for Finnish tax reporting.
 */

import type { TaxCategory } from '@/types';
import type { MoralisHistoryTransaction } from '@/lib/moralis/types';
import { DEX_ROUTER_LABELS, DISPOSAL_KEYWORDS, RECEIVE_KEYWORDS } from './types';

/**
 * Check if a transaction is an internal transfer between the user's own wallets.
 */
export function isInternalTransfer(
  from: string,
  to: string,
  userWallets: string[],
): boolean {
  const normalizedWallets = userWallets.map((w) => w.toLowerCase());
  return (
    normalizedWallets.includes(from.toLowerCase()) &&
    normalizedWallets.includes(to.toLowerCase())
  );
}

/**
 * Determine the tax category for a Moralis wallet history transaction.
 *
 * Categories:
 * - 'transfer': internal movements between user wallets, or unclear purpose
 * - 'disposal': swaps, sells, or outgoing token transfers to external addresses
 * - 'income': airdrops, staking rewards, received tokens without corresponding outflows
 * - 'purchase': incoming tokens from exchanges or purchases
 */
export function categorizeTransaction(
  tx: MoralisHistoryTransaction,
  userWallets: string[],
): TaxCategory {
  const normalizedWallets = userWallets.map((w) => w.toLowerCase());
  const from = tx.from_address?.toLowerCase() ?? '';
  const to = tx.to_address?.toLowerCase() ?? '';
  const summary = (tx.summary ?? '').toLowerCase();
  const methodLabel = (tx.method_label ?? '').toLowerCase();

  // 1. Internal transfer: both from and to are user wallets
  if (
    normalizedWallets.includes(from) &&
    normalizedWallets.includes(to)
  ) {
    return 'transfer';
  }

  // 2. Check ERC20 transfers for swap patterns
  const erc20Transfers = tx.erc20_transfers ?? [];
  if (erc20Transfers.length > 0) {
    const sentTokens = erc20Transfers.filter((t) =>
      normalizedWallets.includes(t.from_address?.toLowerCase() ?? ''),
    );
    const receivedTokens = erc20Transfers.filter((t) =>
      normalizedWallets.includes(t.to_address?.toLowerCase() ?? ''),
    );

    // Swap pattern: sent tokens AND received different tokens in same tx
    if (sentTokens.length > 0 && receivedTokens.length > 0) {
      return 'disposal';
    }

    // Only sent tokens: disposal
    if (sentTokens.length > 0 && receivedTokens.length === 0) {
      return 'disposal';
    }

    // Only received tokens: could be income or purchase
    if (receivedTokens.length > 0 && sentTokens.length === 0) {
      // If from address is not one of user's wallets, it's incoming
      // Heuristic: known exchange entity labels suggest purchase
      const fromEntity = receivedTokens[0]?.from_address_entity?.toLowerCase() ?? '';
      if (fromEntity && isKnownExchangeEntity(fromEntity)) {
        return 'purchase';
      }
      return 'income';
    }
  }

  // 3. Check summary for disposal keywords
  if (DISPOSAL_KEYWORDS.some((kw) => summary.includes(kw))) {
    return 'disposal';
  }

  // 4. Check method label / to_address entity for DEX routers
  if (isDexInteraction(methodLabel, tx.to_address_entity)) {
    return 'disposal';
  }

  // 5. Check summary for receive keywords
  if (RECEIVE_KEYWORDS.some((kw) => summary.includes(kw))) {
    // Received from external address
    if (!normalizedWallets.includes(from)) {
      const fromEntity = (tx.from_address_entity ?? '').toLowerCase();
      if (fromEntity && isKnownExchangeEntity(fromEntity)) {
        return 'purchase';
      }
      return 'income';
    }
  }

  // 6. Native transfer analysis
  const nativeTransfers = tx.native_transfers ?? [];
  if (nativeTransfers.length > 0) {
    const sentNative = nativeTransfers.filter(
      (t) => t.direction === 'send' || normalizedWallets.includes(t.from_address?.toLowerCase() ?? ''),
    );
    const receivedNative = nativeTransfers.filter(
      (t) => t.direction === 'receive' || normalizedWallets.includes(t.to_address?.toLowerCase() ?? ''),
    );

    if (sentNative.length > 0 && receivedNative.length === 0) {
      return 'disposal';
    }
    if (receivedNative.length > 0 && sentNative.length === 0) {
      // Check if this is from an exchange
      const nativeFrom = (nativeTransfers[0]?.from_address_entity ?? '').toLowerCase();
      if (nativeFrom && isKnownExchangeEntity(nativeFrom)) {
        return 'purchase';
      }
      return 'income';
    }
    // Both sent and received native: likely a contract interaction with gas
    // If the user sent more than they received, it's a disposal
    const totalSent = sentNative.reduce((sum, t) => sum + parseFloat(t.value_formatted || '0'), 0);
    const totalReceived = receivedNative.reduce((sum, t) => sum + parseFloat(t.value_formatted || '0'), 0);
    if (totalSent > totalReceived * 1.01) {
      return 'disposal';
    }
  }

  // 7. If wallet only sent native value (no ERC20/native_transfers arrays but has value)
  const txValue = BigInt(tx.value || '0');
  if (txValue > BigInt(0)) {
    const isSender = normalizedWallets.includes(from);
    const isReceiver = normalizedWallets.includes(to);
    if (isSender && !isReceiver) return 'disposal';
    if (isReceiver && !isSender) return 'income';
  }

  // 8. Default: treat as transfer if truly unclear
  return 'transfer';
}

/**
 * Check if a method label or target entity indicates a DEX router interaction.
 */
function isDexInteraction(
  methodLabel: string,
  toAddressEntity: string | null,
): boolean {
  const entity = (toAddressEntity ?? '').toLowerCase();
  return DEX_ROUTER_LABELS.some(
    (dex) => methodLabel.includes(dex) || entity.includes(dex),
  );
}

/**
 * Heuristic check for known centralized exchange entity names.
 */
function isKnownExchangeEntity(entity: string): boolean {
  const exchanges = [
    'binance',
    'coinbase',
    'kraken',
    'crypto.com',
    'bybit',
    'okx',
    'kucoin',
    'gate.io',
    'bitfinex',
    'gemini',
    'revolut',
    'bitstamp',
  ];
  return exchanges.some((ex) => entity.includes(ex));
}
