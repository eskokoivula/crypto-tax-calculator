"use client";

import { useMemo, useState } from "react";
import type { TaxCategory, Transaction } from "@/types";
import { CHAIN_NAMES } from "@/types";
import {
  formatDateTime,
  formatEur,
  shortenAddress,
  cn,
} from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWalletStore } from "@/store/wallet-store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalletBadge } from "@/components/wallet/wallet-badge";
import { CategoryBadge } from "@/components/transactions/category-badge";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField =
  | "date"
  | "tokenSymbol"
  | "amountFormatted"
  | "valueEur"
  | "costBasisEur"
  | "gainLossEur"
  | "category"
  | "source"
  | "gasFeeEur";

type SortDir = "asc" | "desc";

interface TransactionTableProps {
  transactions: Transaction[];
  onCategoryOverride: (txId: string, category: TaxCategory) => void;
}

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compare(a: Transaction, b: Transaction, field: SortField): number {
  switch (field) {
    case "date":
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    case "tokenSymbol":
      return a.tokenSymbol.localeCompare(b.tokenSymbol);
    case "amountFormatted":
      return a.amountFormatted - b.amountFormatted;
    case "valueEur":
      return a.valueEur - b.valueEur;
    case "costBasisEur":
      return (a.costBasisEur ?? 0) - (b.costBasisEur ?? 0);
    case "gainLossEur":
      return (a.gainLossEur ?? 0) - (b.gainLossEur ?? 0);
    case "category": {
      const ac = a.categoryOverride ?? a.category;
      const bc = b.categoryOverride ?? b.category;
      return ac.localeCompare(bc);
    }
    case "source":
      return a.source.localeCompare(b.source);
    case "gasFeeEur":
      return (a.gasFeeEur + a.exchangeFeeEur) - (b.gasFeeEur + b.exchangeFeeEur);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable({
  transactions,
  onCategoryOverride,
}: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { columnVisibility } = useUiStore();
  const wallets = useWalletStore((s) => s.wallets);
  const walletMap = useMemo(
    () => new Map(wallets.map((w) => [w.address, w])),
    [wallets]
  );

  const sorted = useMemo(() => {
    const arr = [...transactions];
    arr.sort((a, b) => {
      const c = compare(a, b, sortField);
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [transactions, sortField, sortDir]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function col(key: string) {
    return columnVisibility[key] !== false;
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDownIcon className="ml-1 inline size-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? (
      <ArrowUpIcon className="ml-1 inline size-3 text-primary" />
    ) : (
      <ArrowDownIcon className="ml-1 inline size-3 text-primary" />
    );
  }

  function SortableHead({
    field,
    label,
    className,
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) {
    return (
      <TableHead
        className={cn("cursor-pointer select-none", className)}
        onClick={() => toggleSort(field)}
      >
        {label}
        <SortIcon field={field} />
      </TableHead>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="border-b border-border/50 hover:bg-transparent">
              {/* Warning indicator */}
              <TableHead className="w-8" />

              {col("date") && (
                <SortableHead field="date" label="Date" />
              )}
              {col("category") && (
                <SortableHead field="category" label="Category" />
              )}
              {col("chain") && <TableHead>Chain</TableHead>}
              {col("token") && (
                <SortableHead field="tokenSymbol" label="Token" />
              )}
              {col("amount") && (
                <SortableHead
                  field="amountFormatted"
                  label="Amount"
                  className="text-right"
                />
              )}
              {col("valueEur") && (
                <SortableHead
                  field="valueEur"
                  label="EUR Value"
                  className="text-right"
                />
              )}
              {col("gainLoss") && (
                <SortableHead
                  field="gainLossEur"
                  label="Gain/Loss"
                  className="text-right"
                />
              )}
              {col("gasFee") && (
                <SortableHead
                  field="gasFeeEur"
                  label="Fees"
                  className="text-right"
                />
              )}
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              {col("wallet") && <TableHead>Wallet</TableHead>}
              {col("source") && (
                <SortableHead field="source" label="Source" />
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.map((tx, idx) => {
              const wallet = walletMap.get(tx.walletAddress);
              const effectiveCat = tx.categoryOverride ?? tx.category;
              const hasWarnings =
                tx.warnings.length > 0 &&
                !tx.warnings.every((w) => w.dismissed);
              const totalFees = tx.gasFeeEur + tx.exchangeFeeEur;

              return (
                <TableRow
                  key={tx.id}
                  className={cn(
                    "border-b border-border/30 transition-colors hover:bg-muted/30",
                    idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                  )}
                >
                  {/* Warning icon */}
                  <TableCell className="w-8 px-2 py-2">
                    {hasWarnings && (
                      <AlertTriangleIcon className="size-3.5 text-yellow-500" />
                    )}
                  </TableCell>

                  {col("date") && (
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {formatDateTime(tx.timestamp)}
                    </TableCell>
                  )}

                  {col("category") && (
                    <TableCell className="py-2">
                      <CategoryBadge
                        category={tx.category}
                        overrideCategory={tx.categoryOverride}
                        onOverride={(cat) => onCategoryOverride(tx.id, cat)}
                      />
                    </TableCell>
                  )}

                  {col("chain") && (
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {CHAIN_NAMES[tx.chain] ?? tx.chain}
                    </TableCell>
                  )}

                  {col("token") && (
                    <TableCell className="py-2 text-sm font-medium text-foreground">
                      {tx.tokenSymbol}
                    </TableCell>
                  )}

                  {col("amount") && (
                    <TableCell className="py-2 text-right font-mono text-xs text-foreground">
                      {tx.amountFormatted.toLocaleString("fi-FI", {
                        maximumFractionDigits: 6,
                      })}
                    </TableCell>
                  )}

                  {col("valueEur") && (
                    <TableCell className="py-2 text-right font-mono text-xs text-foreground">
                      {formatEur(tx.valueEur)}
                    </TableCell>
                  )}

                  {col("gainLoss") && (
                    <TableCell
                      className={cn(
                        "py-2 text-right font-mono text-xs font-medium",
                        tx.gainLossEur != null && tx.gainLossEur > 0
                          ? "text-emerald-400"
                          : tx.gainLossEur != null && tx.gainLossEur < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {tx.gainLossEur != null
                        ? formatEur(tx.gainLossEur)
                        : "-"}
                    </TableCell>
                  )}

                  {col("gasFee") && (
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      {totalFees > 0 ? formatEur(totalFees) : "-"}
                    </TableCell>
                  )}

                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                    {shortenAddress(tx.from)}
                  </TableCell>

                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                    {shortenAddress(tx.to)}
                  </TableCell>

                  {col("wallet") && (
                    <TableCell className="py-2">
                      {wallet ? (
                        <WalletBadge
                          address={wallet.address}
                          color={wallet.color}
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortenAddress(tx.walletAddress)}
                        </span>
                      )}
                    </TableCell>
                  )}

                  {col("source") && (
                    <TableCell className="py-2 text-xs capitalize text-muted-foreground">
                      {tx.source}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Showing {visible.length} of {sorted.length} transactions
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-lg bg-muted/50 px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
