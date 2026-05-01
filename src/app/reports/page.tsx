'use client';

import { useState, useMemo } from 'react';
import { useTransactionStore } from '@/store/transaction-store';
import { UserInfoForm } from '@/components/reports/user-info-form';
import { ReportPreview } from '@/components/reports/report-preview';
import { ExportButtons } from '@/components/reports/export-buttons';
import type { UserInfo, Lomake9Data } from '@/lib/export/types';
import type { Transaction } from '@/types';
import { FINNISH_TAX } from '@/types';

export default function ReportsPage() {
  const getFilteredTransactions = useTransactionStore(
    (s) => s.getFilteredTransactions,
  );
  const getTaxSummary = useTransactionStore((s) => s.getTaxSummary);

  const transactions = getFilteredTransactions();
  const summary = getTaxSummary();

  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: '',
    henkilotunnus: '',
  });

  // Derive the current tax year from the most recent transaction, fallback to
  // the previous calendar year.
  const taxYear = useMemo(() => {
    if (transactions.length === 0) return new Date().getFullYear() - 1;
    const latest = transactions.reduce((a, b) =>
      new Date(a.timestamp) > new Date(b.timestamp) ? a : b,
    );
    return new Date(latest.timestamp).getFullYear();
  }, [transactions]);

  // Build Lomake9Data entries from disposal transactions
  const disposals: Lomake9Data[] = useMemo(() => {
    return transactions
      .filter((tx) => (tx.categoryOverride ?? tx.category) === 'disposal')
      .map((tx) => buildLomake9Entry(tx, userInfo, taxYear));
  }, [transactions, userInfo, taxYear]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generate Lomake 9 and export tax reports
        </p>
      </div>

      <UserInfoForm value={userInfo} onChange={setUserInfo} />

      <ReportPreview
        transactions={transactions}
        summary={summary}
        taxYear={taxYear}
      />

      <ExportButtons
        transactions={transactions}
        summary={summary}
        userInfo={userInfo}
        taxYear={taxYear}
        disposals={disposals}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLomake9Entry(
  tx: Transaction,
  userInfo: UserInfo,
  taxYear: number,
): Lomake9Data {
  const salePriceEur = tx.valueEur;
  const costBasis = tx.costBasisEur ?? 0;
  const fees = (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0);

  // Deemed cost (hankintameno-olettama) — always 20% for < 10 years
  const deemedCostEur = salePriceEur * FINNISH_TAX.DEEMED_COST_SHORT;

  const actualGain = salePriceEur - costBasis - fees;
  const deemedGain = salePriceEur - deemedCostEur;
  const useDeemedCost = tx.usedDeemedCost ?? deemedGain < actualGain;
  const finalGain = useDeemedCost ? deemedGain : actualGain;

  return {
    name: userInfo.name,
    henkilotunnus: userInfo.henkilotunnus,
    taxYear,
    cryptoNames: tx.tokenSymbol,
    disposalDate: new Date(tx.timestamp),
    acquisitionDate: new Date(tx.timestamp), // Approximation — FIFO lot date would be ideal
    salePriceEur,
    acquisitionCostEur: costBasis,
    acquisitionExpensesEur: fees,
    deemedCostEur,
    gainEur: finalGain > 0 ? finalGain : 0,
    lossEur: finalGain < 0 ? Math.abs(finalGain) : 0,
    useDeemedCost,
  };
}
