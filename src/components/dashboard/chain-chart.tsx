"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Transaction, ChainId } from "@/types";
import { CHAIN_NAMES } from "@/types";
import { formatEur } from "@/lib/utils";

interface ChainChartProps {
  transactions: Transaction[];
}

const CHART_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#14b8a6",
  "#a855f7",
  "#818cf8",
];

export function ChainChart({ transactions }: ChainChartProps) {
  const volumeByChain = new Map<ChainId, number>();

  for (const tx of transactions) {
    const current = volumeByChain.get(tx.chain) ?? 0;
    volumeByChain.set(tx.chain, current + Math.abs(tx.valueEur || 0));
  }

  const data = Array.from(volumeByChain.entries())
    .map(([chain, volume]) => ({
      chain,
      name: CHAIN_NAMES[chain] ?? chain,
      volume,
    }))
    .sort((a, b) => b.volume - a.volume);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-sm font-medium text-foreground">
          Volume by Chain
        </h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No transaction data yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Volume by Chain
      </h3>
      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatEur(v)}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
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
          <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
