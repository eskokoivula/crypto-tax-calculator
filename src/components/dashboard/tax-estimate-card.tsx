"use client";

import type { TaxSummary } from "@/types";
import { FINNISH_TAX } from "@/types";
import { formatEur } from "@/lib/utils";

interface TaxEstimateCardProps {
  summary: TaxSummary;
}

export function TaxEstimateCard({ summary }: TaxEstimateCardProps) {
  const { taxableGainsEur, estimatedTaxEur } = summary;
  const { CAPITAL_GAINS_RATE_LOW, CAPITAL_GAINS_RATE_HIGH, CAPITAL_GAINS_THRESHOLD } =
    FINNISH_TAX;

  const thresholdUsed = Math.min(
    Math.max(taxableGainsEur, 0),
    CAPITAL_GAINS_THRESHOLD
  );
  const thresholdPercent = (thresholdUsed / CAPITAL_GAINS_THRESHOLD) * 100;

  const taxAtLow =
    Math.min(Math.max(taxableGainsEur, 0), CAPITAL_GAINS_THRESHOLD) *
    CAPITAL_GAINS_RATE_LOW;
  const taxAtHigh =
    taxableGainsEur > CAPITAL_GAINS_THRESHOLD
      ? (taxableGainsEur - CAPITAL_GAINS_THRESHOLD) * CAPITAL_GAINS_RATE_HIGH
      : 0;

  const hasData = taxableGainsEur !== 0 || estimatedTaxEur !== 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-medium text-foreground">
        Estimated Tax Liability
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Finnish capital gains tax (
        {(CAPITAL_GAINS_RATE_LOW * 100).toFixed(0)}% /{" "}
        {(CAPITAL_GAINS_RATE_HIGH * 100).toFixed(0)}%)
      </p>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total taxable gains</span>
          <span className="font-medium text-foreground">
            {hasData ? formatEur(taxableGainsEur) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tax at {(CAPITAL_GAINS_RATE_LOW * 100).toFixed(0)}% (first{" "}
            {formatEur(CAPITAL_GAINS_THRESHOLD)})
          </span>
          <span className="font-medium text-foreground">
            {hasData ? formatEur(taxAtLow) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tax at {(CAPITAL_GAINS_RATE_HIGH * 100).toFixed(0)}% (above{" "}
            {formatEur(CAPITAL_GAINS_THRESHOLD)})
          </span>
          <span className="font-medium text-foreground">
            {hasData ? formatEur(taxAtHigh) : "--"}
          </span>
        </div>

        <div className="border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Total estimated tax
            </span>
            <span className="text-lg font-bold text-foreground">
              {hasData ? formatEur(estimatedTaxEur) : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Threshold progress bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {(CAPITAL_GAINS_RATE_LOW * 100).toFixed(0)}% bracket usage
          </span>
          <span>
            {hasData ? formatEur(thresholdUsed) : "--"} /{" "}
            {formatEur(CAPITAL_GAINS_THRESHOLD)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(thresholdPercent, 100)}%` }}
          />
        </div>
        {taxableGainsEur > CAPITAL_GAINS_THRESHOLD && (
          <p className="mt-1 text-xs text-amber-400">
            Gains exceed the {formatEur(CAPITAL_GAINS_THRESHOLD)} threshold.
            Additional gains taxed at{" "}
            {(CAPITAL_GAINS_RATE_HIGH * 100).toFixed(0)}%.
          </p>
        )}
      </div>
    </div>
  );
}
