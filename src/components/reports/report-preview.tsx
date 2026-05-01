'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Transaction, TaxSummary } from '@/types';
import { CHAIN_NAMES } from '@/types';
import { formatEur } from '@/lib/utils';

interface ReportPreviewProps {
  transactions: Transaction[];
  summary: TaxSummary;
  taxYear: number;
}

export function ReportPreview({
  transactions,
  summary,
  taxYear,
}: ReportPreviewProps) {
  const chains = Array.from(
    new Set(transactions.map((tx) => CHAIN_NAMES[tx.chain] ?? tx.chain)),
  );

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            No transactions loaded. Add wallets or import exchanges to generate
            reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Report Preview &mdash; Verovuosi {taxYear}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This report covers{' '}
          <span className="font-medium text-foreground">
            {transactions.length}
          </span>{' '}
          transaction{transactions.length !== 1 ? 's' : ''} across{' '}
          <span className="font-medium text-foreground">{chains.length}</span>{' '}
          chain{chains.length !== 1 ? 's' : ''}{' '}
          <span className="text-xs">({chains.join(', ')})</span>
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Realized Gains"
            value={formatEur(summary.totalRealizedGainsEur)}
            positive={summary.totalRealizedGainsEur >= 0}
          />
          <MiniStat
            label="Income"
            value={formatEur(summary.totalIncomeEur)}
            positive
          />
          <MiniStat
            label="Fees & Costs"
            value={formatEur(summary.totalFeesEur)}
            positive={false}
          />
          <MiniStat
            label="Estimated Tax"
            value={formatEur(summary.estimatedTaxEur)}
            positive={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountStat label="Disposals" count={summary.disposalCount} />
          <CountStat label="Income" count={summary.incomeCount} />
          <CountStat label="Transfers" count={summary.transferCount} />
          <CountStat label="Purchases" count={summary.purchaseCount} />
        </div>

        {summary.issueCount > 0 && (
          <p className="text-xs text-amber-400">
            {summary.issueCount} transaction{summary.issueCount !== 1 ? 's' : ''}{' '}
            have warnings that may need review before filing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold ${
          positive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CountStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{count}</p>
    </div>
  );
}
