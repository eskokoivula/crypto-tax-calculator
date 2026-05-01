"use client";

import { useCallback, useRef } from 'react';
import { useWalletStore } from '@/store/wallet-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useNotificationStore } from '@/store/notification-store';
import { runFullPipeline } from '@/lib/pipeline';

export function usePipeline() {
  const { wallets, taxYear, updateWallet } = useWalletStore();
  const { setTransactions, setBalances, setLoading, setProgress } = useTransactionStore();
  const { addWarning, clearWarnings } = useNotificationStore();
  const abortRef = useRef(false);

  const run = useCallback(async () => {
    const enabledWallets = wallets.filter((w) => w.enabled);
    if (enabledWallets.length === 0) return;

    setLoading(true);
    clearWarnings();
    abortRef.current = false;

    try {
      const result = await runFullPipeline(
        enabledWallets,
        taxYear,
        (progress) => {
          if (!abortRef.current) {
            setProgress(progress);
          }
        },
      );

      if (!abortRef.current) {
        setTransactions(result.transactions);
        setBalances(result.balances);
        result.warnings.forEach((w) => addWarning(w));

        // BUG 6 FIX: Update each wallet with its detected chains
        result.walletChains.forEach((chains, address) => {
          updateWallet(address, { detectedChains: chains, loading: false });
        });
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      addWarning({
        severity: 'error',
        message: `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dismissed: false,
      });
    } finally {
      setLoading(false);
      setProgress(null);
      // Mark all wallets as no longer loading even if pipeline failed
      for (const w of enabledWallets) {
        updateWallet(w.address, { loading: false });
      }
    }
  }, [wallets, taxYear, setTransactions, setBalances, setLoading, setProgress, addWarning, clearWarnings, updateWallet]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { run, abort };
}
