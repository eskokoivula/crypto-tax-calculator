"use client";

import { useState, useEffect } from "react";
import { WalletIcon } from "lucide-react";
import { useWalletStore } from "@/store/wallet-store";
import { useTransactionStore } from "@/store/transaction-store";
import { HoldingsTable } from "@/components/holdings/holdings-table";

export default function HoldingsPage() {
  const { wallets } = useWalletStore();
  const balances = useTransactionStore((s) => s.balances);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Holdings</h1>
        <p className="text-sm text-muted-foreground">
          Current token balances across your wallets
        </p>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 bg-card/50 py-24">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <WalletIcon className="size-7 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No wallets added yet</p>
            <p className="text-sm text-muted-foreground">
              Add a wallet in the sidebar to view your holdings.
            </p>
          </div>
        </div>
      ) : (
        <HoldingsTable holdings={balances} />
      )}
    </div>
  );
}
