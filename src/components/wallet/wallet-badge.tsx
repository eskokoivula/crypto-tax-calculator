"use client";

import { cn, shortenAddress } from "@/lib/utils";
import { CHAIN_NAMES, type ChainId } from "@/types";

interface WalletBadgeProps {
  address: string;
  color: string;
  chains?: ChainId[];
  className?: string;
}

export function WalletBadge({ address, color, chains, className }: WalletBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono">{shortenAddress(address)}</span>
      {chains && chains.length > 0 && (
        <span className="text-muted-foreground">
          {chains.map((c) => CHAIN_NAMES[c]?.slice(0, 3)).join(", ")}
        </span>
      )}
    </span>
  );
}
