"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, Layers, List } from "lucide-react";
import type { TokenBalance } from "@/types";
import { CHAIN_NAMES } from "@/types";
import { formatEur, shortenAddress } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface HoldingsTableProps {
  holdings: TokenBalance[];
}

type SortField = "eurValue" | "balanceFormatted" | "priceChange24h" | "portfolioPercentage";
type SortDir = "asc" | "desc";

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortField, setSortField] = useState<SortField>("eurValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupByWallet, setGroupByWallet] = useState(false);

  const totalValue = useMemo(
    () => holdings.reduce((sum, h) => sum + h.eurValue, 0),
    [holdings]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...holdings];
    copy.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return copy;
  }, [holdings, sortField, sortDir]);

  // Group by wallet address
  const grouped = useMemo(() => {
    if (!groupByWallet) return null;
    const map = new Map<string, TokenBalance[]>();
    for (const h of sorted) {
      const addr = h.walletAddress.toLowerCase();
      const list = map.get(addr) ?? [];
      list.push(h);
      map.set(addr, list);
    }
    return map;
  }, [sorted, groupByWallet]);

  if (holdings.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/50 py-24">
        <p className="text-muted-foreground">
          No holdings data available. Sync your wallets to see token balances.
        </p>
      </div>
    );
  }

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {children}
      <ArrowUpDown className={`size-3 ${sortField === field ? "text-primary" : ""}`} />
    </button>
  );

  const renderRow = (h: TokenBalance, index: number) => (
    <TableRow key={`${h.walletAddress}-${h.tokenAddress}-${h.chain}-${index}`}>
      <TableCell>
        <div className="flex items-center gap-2">
          {h.logo ? (
            <img
              src={h.logo}
              alt={h.symbol}
              className="size-6 rounded-full"
            />
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
              {h.symbol?.slice(0, 2) ?? "?"}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{h.name}</p>
            <p className="text-xs text-muted-foreground">
              {h.symbol} on {CHAIN_NAMES[h.chain] ?? h.chain}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right text-sm text-foreground tabular-nums">
        {h.balanceFormatted.toLocaleString("fi-FI", {
          maximumFractionDigits: 6,
        })}
      </TableCell>
      <TableCell className="text-right text-sm font-medium text-foreground tabular-nums">
        {formatEur(h.eurValue)}
      </TableCell>
      <TableCell className="text-right">
        {h.priceChange24h != null ? (
          <span
            className={`text-sm tabular-nums ${
              h.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {h.priceChange24h >= 0 ? "+" : ""}
            {h.priceChange24h.toFixed(2)}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">--</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {h.portfolioPercentage.toFixed(1)}%
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(h.portfolioPercentage, 100)}%` }}
            />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Header with total and toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
          <p className="text-xl font-bold text-foreground">{formatEur(totalValue)}</p>
        </div>
        <button
          onClick={() => setGroupByWallet(!groupByWallet)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {groupByWallet ? (
            <List className="size-3.5" />
          ) : (
            <Layers className="size-3.5" />
          )}
          {groupByWallet ? "Flat list" : "Group by wallet"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs text-muted-foreground">Token</TableHead>
              <TableHead className="text-right text-xs text-muted-foreground">
                <SortButton field="balanceFormatted">Balance</SortButton>
              </TableHead>
              <TableHead className="text-right text-xs text-muted-foreground">
                <SortButton field="eurValue">EUR Value</SortButton>
              </TableHead>
              <TableHead className="text-right text-xs text-muted-foreground">
                <SortButton field="priceChange24h">24h Change</SortButton>
              </TableHead>
              <TableHead className="text-right text-xs text-muted-foreground">
                <SortButton field="portfolioPercentage">Allocation</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupByWallet && grouped
              ? Array.from(grouped.entries()).map(([addr, tokens]) => (
                  <React.Fragment key={addr}>
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="bg-muted/30 py-2 text-xs font-medium text-muted-foreground"
                      >
                        {shortenAddress(addr)}
                      </TableCell>
                    </TableRow>
                    {tokens.map((h, i) => renderRow(h, i))}
                  </React.Fragment>
                ))
              : sorted.map((h, i) => renderRow(h, i))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
