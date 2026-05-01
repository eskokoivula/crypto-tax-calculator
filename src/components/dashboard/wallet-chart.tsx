"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { Wallet, Transaction } from "@/types";
import { formatEur, shortenAddress } from "@/lib/utils";

interface WalletChartProps {
  wallets: Wallet[];
  transactions: Transaction[];
}

export function WalletChart({ wallets, transactions }: WalletChartProps) {
  // Aggregate transaction volume per wallet as a proxy for portfolio distribution
  const volumeByWallet = new Map<string, number>();

  for (const tx of transactions) {
    const addr = tx.walletAddress.toLowerCase();
    const current = volumeByWallet.get(addr) ?? 0;
    volumeByWallet.set(addr, current + Math.abs(tx.valueEur || 0));
  }

  const data = wallets
    .filter((w) => w.enabled)
    .map((w) => ({
      address: w.address,
      name: w.label || shortenAddress(w.address),
      value: volumeByWallet.get(w.address.toLowerCase()) ?? 0,
      color: w.color,
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-sm font-medium text-foreground">
          Portfolio by Wallet
        </h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No wallet data yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Portfolio by Wallet
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatEur(Number(value)), "Volume"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--foreground))",
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
