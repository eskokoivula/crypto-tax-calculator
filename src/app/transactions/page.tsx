"use client";

import { useMemo, useState, useCallback } from "react";
import { useTransactionStore } from "@/store/transaction-store";
import { useWalletStore } from "@/store/wallet-store";
import type { TaxCategory, Transaction } from "@/types";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { SearchBar } from "@/components/transactions/search-bar";
import { DateFilter } from "@/components/transactions/date-filter";
import { SourceFilter } from "@/components/transactions/source-filter";
import { ColumnToggle } from "@/components/transactions/column-toggle";
import { InboxIcon } from "lucide-react";

export default function TransactionsPage() {
  const allTransactions = useTransactionStore((s) => s.getFilteredTransactions());
  const addModification = useTransactionStore((s) => s.addModification);
  const wallets = useWalletStore((s) => s.wallets);
  const toggleWallet = useWalletStore((s) => s.toggleWallet);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const handleDateChange = useCallback(
    (from: Date | null, to: Date | null) => {
      setFromDate(from);
      setToDate(to);
    },
    []
  );

  const enabledAddresses = useMemo(
    () => new Set(wallets.filter((w) => w.enabled).map((w) => w.address)),
    [wallets]
  );

  const filtered = useMemo(() => {
    let txs = allTransactions;

    // Filter by enabled wallets
    if (enabledAddresses.size > 0) {
      txs = txs.filter((tx) => enabledAddresses.has(tx.walletAddress));
    }

    // Date range
    if (fromDate) {
      txs = txs.filter((tx) => new Date(tx.timestamp) >= fromDate);
    }
    if (toDate) {
      txs = txs.filter((tx) => new Date(tx.timestamp) <= toDate);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      txs = txs.filter(
        (tx) =>
          tx.tokenName.toLowerCase().includes(q) ||
          tx.tokenSymbol.toLowerCase().includes(q) ||
          tx.from.toLowerCase().includes(q) ||
          tx.to.toLowerCase().includes(q) ||
          tx.txHash.toLowerCase().includes(q)
      );
    }

    return txs;
  }, [allTransactions, enabledAddresses, fromDate, toDate, search]);

  function handleCategoryOverride(txId: string, category: TaxCategory) {
    addModification({
      id: `override-${txId}-${category}`,
      description: `Recategorize transaction as ${category}`,
      type: "recategorize",
      recategorizations: [{ txId, newCategory: category }],
      active: true,
      createdAt: new Date(),
    });
  }

  const isEmpty = filtered.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          View and categorize your crypto transactions
        </p>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Row 1: search + column toggle */}
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex-1" />
          <ColumnToggle />
        </div>

        {/* Row 2: date filter + source filter */}
        <div className="flex flex-wrap items-center gap-4">
          <DateFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={handleDateChange}
          />
          {wallets.length > 0 && (
            <>
              <div className="h-5 w-px bg-border" />
              <SourceFilter
                wallets={wallets}
                onToggleWallet={toggleWallet}
              />
            </>
          )}
        </div>
      </div>

      {/* Table or empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/50 py-24">
          <InboxIcon className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {allTransactions.length === 0
              ? "Transaction data will appear here once wallets are synced."
              : "No transactions match your current filters."}
          </p>
        </div>
      ) : (
        <TransactionTable
          transactions={filtered}
          onCategoryOverride={handleCategoryOverride}
        />
      )}
    </div>
  );
}
