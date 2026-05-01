"use client";

import { TrendingUp, TrendingDown, Coins, Receipt, Wallet } from "lucide-react";
import type { TaxSummary } from "@/types";
import { formatEur } from "@/lib/utils";

interface SummaryCardsProps {
  summary: TaxSummary;
}

interface MetricCardProps {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  colorClass?: string;
}

function MetricCard({ label, value, icon, colorClass }: MetricCardProps) {
  const hasData = value !== null && value !== undefined;
  const displayValue = hasData ? formatEur(value) : "--";

  let valueColor = "text-foreground";
  if (colorClass) {
    valueColor = colorClass;
  } else if (hasData && value > 0) {
    valueColor = "text-emerald-400";
  } else if (hasData && value < 0) {
    valueColor = "text-red-400";
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{displayValue}</p>
    </div>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const hasTransactions =
    summary.disposalCount > 0 ||
    summary.incomeCount > 0 ||
    summary.purchaseCount > 0 ||
    summary.transferCount > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        label="Total Realized Gains (EUR)"
        value={hasTransactions ? summary.totalRealizedGainsEur : null}
        icon={
          summary.totalRealizedGainsEur >= 0 ? (
            <TrendingUp className="size-4" />
          ) : (
            <TrendingDown className="size-4" />
          )
        }
        colorClass={
          hasTransactions
            ? summary.totalRealizedGainsEur >= 0
              ? "text-emerald-400"
              : "text-red-400"
            : undefined
        }
      />
      <MetricCard
        label="Unrealized Gains (EUR)"
        value={hasTransactions ? summary.totalUnrealizedGainsEur : null}
        icon={<TrendingUp className="size-4" />}
      />
      <MetricCard
        label="Total Income (EUR)"
        value={hasTransactions ? summary.totalIncomeEur : null}
        icon={<Coins className="size-4" />}
        colorClass={
          hasTransactions && summary.totalIncomeEur > 0
            ? "text-emerald-400"
            : undefined
        }
      />
      <MetricCard
        label="Total Fees & Costs (EUR)"
        value={hasTransactions ? summary.totalFeesEur : null}
        icon={<Receipt className="size-4" />}
        colorClass={
          hasTransactions && summary.totalFeesEur > 0
            ? "text-red-400"
            : undefined
        }
      />
      <MetricCard
        label="Net Position (EUR)"
        value={hasTransactions ? summary.netPositionEur : null}
        icon={<Wallet className="size-4" />}
      />
    </div>
  );
}
