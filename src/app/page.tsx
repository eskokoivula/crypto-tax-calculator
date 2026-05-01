"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { WalletIcon, ScanSearchIcon } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useTransactionStore } from "@/store/transaction-store";
import { useNotificationStore } from "@/store/notification-store";
import { usePipeline } from "@/hooks/use-pipeline";
import { OnboardingWizard } from "@/components/wallet/onboarding-wizard";
import { PipelineStatus } from "@/components/pipeline/pipeline-status";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TaxEstimateCard } from "@/components/dashboard/tax-estimate-card";
import { ChainChart } from "@/components/dashboard/chain-chart";
import { WalletChart } from "@/components/dashboard/wallet-chart";
import { IssuesCard } from "@/components/dashboard/issues-card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { wallets, taxYear } = useWalletStore();
  const { transactions, loading, getTaxSummary, getFilteredTransactions } =
    useTransactionStore();
  const { getActiveWarnings } = useNotificationStore();
  const { run, abort } = usePipeline();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track previous wallet/year state for auto-run debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && wallets.length === 0) {
      setShowOnboarding(true);
    }
  }, [mounted, wallets.length]);

  // Auto-run pipeline when wallets or tax year change (debounced)
  useEffect(() => {
    if (!mounted) return;

    const enabledWallets = wallets.filter((w) => w.enabled);
    if (enabledWallets.length === 0) return;

    const key = enabledWallets.map((w) => w.address).sort().join(",") + ":" + taxYear;
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    // Skip auto-run on first mount if we already have transactions
    if (transactions.length > 0 && !debounceRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (!loading) {
        run();
      }
    }, 1500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [mounted, wallets, taxYear, loading, run, transactions.length]);

  const summary = useMemo(() => getTaxSummary(), [transactions]);
  const filtered = useMemo(() => getFilteredTransactions(), [transactions]);

  const activeWarnings = useMemo(() => getActiveWarnings(), [transactions]);
  const errorCount = useMemo(
    () => activeWarnings.filter((w) => w.severity === "error").length,
    [activeWarnings]
  );
  const warningCount = useMemo(
    () => activeWarnings.filter((w) => w.severity === "warning").length,
    [activeWarnings]
  );

  if (!mounted) return null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of your crypto tax position
            </p>
          </div>

          {wallets.filter((w) => w.enabled).length > 0 && (
            <Button
              onClick={run}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              <ScanSearchIcon className="size-4" />
              {loading ? "Scanning..." : "Scan Wallets"}
            </Button>
          )}
        </div>

        {/* Pipeline progress */}
        {loading && <PipelineStatus onAbort={abort} />}

        {wallets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 bg-card/50 py-24">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <WalletIcon className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">No wallets added yet</p>
              <p className="text-sm text-muted-foreground">
                Add a wallet in the sidebar or use the setup wizard to get started.
              </p>
            </div>
            <button
              onClick={() => setShowOnboarding(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Launch setup wizard
            </button>
          </div>
        ) : (
          <>
            {/* Summary metric cards */}
            <SummaryCards summary={summary} />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Tax estimate */}
              <TaxEstimateCard summary={summary} />

              {/* Issues */}
              <div className="space-y-6">
                <IssuesCard
                  issueCount={summary.issueCount}
                  errorCount={errorCount}
                  warningCount={warningCount}
                />
                {/* Wallet chart */}
                <WalletChart wallets={wallets} transactions={filtered} />
              </div>
            </div>

            {/* Chain chart */}
            <ChainChart transactions={filtered} />
          </>
        )}
      </div>

      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}
    </>
  );
}
