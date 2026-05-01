"use client";

import type { Wallet } from "@/types";
import { shortenAddress } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface SourceFilterProps {
  wallets: Wallet[];
  onToggleWallet: (address: string) => void;
}

export function SourceFilter({ wallets, onToggleWallet }: SourceFilterProps) {
  const allEnabled = wallets.every((w) => w.enabled);
  const noneEnabled = wallets.every((w) => !w.enabled);

  function selectAll() {
    wallets.forEach((w) => {
      if (!w.enabled) onToggleWallet(w.address);
    });
  }

  function deselectAll() {
    wallets.forEach((w) => {
      if (w.enabled) onToggleWallet(w.address);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={selectAll}
          disabled={allEnabled}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          All
        </button>
        <span className="text-muted-foreground/40">|</span>
        <button
          type="button"
          onClick={deselectAll}
          disabled={noneEnabled}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          None
        </button>
      </div>

      <div className="h-4 w-px bg-border" />

      {wallets.map((wallet) => (
        <label
          key={wallet.address}
          className="flex cursor-pointer items-center gap-1.5"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: wallet.color }}
          />
          <span className="font-mono text-xs text-foreground">
            {wallet.label || shortenAddress(wallet.address)}
          </span>
          <Switch
            size="sm"
            checked={wallet.enabled}
            onCheckedChange={() => onToggleWallet(wallet.address)}
          />
        </label>
      ))}
    </div>
  );
}
