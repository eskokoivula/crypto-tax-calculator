"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWalletStore } from "@/store/wallet-store";
import { isValidWalletAddress, shortenAddress } from "@/lib/utils";

interface WalletManagerProps {
  collapsed?: boolean;
}

export function WalletManager({ collapsed = false }: WalletManagerProps) {
  const { wallets, addWallet, removeWallet, toggleWallet } = useWalletStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    const address = input.trim();
    setError("");

    const walletType = isValidWalletAddress(address);
    if (!walletType) {
      setError("Invalid address. Supports EVM (0x...) and Solana");
      return;
    }

    if (wallets.length >= 10) {
      setError("Maximum 10 wallets reached");
      return;
    }

    const normalized = walletType === 'evm' ? address.toLowerCase() : address;
    if (wallets.some((w) => w.address === normalized)) {
      setError("Wallet already added");
      return;
    }

    addWallet(address);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAdd();
  }

  const detectedType = input.trim() ? isValidWalletAddress(input.trim()) : null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        {wallets.map((w) => (
          <span
            key={w.address}
            className="size-3 rounded-full"
            style={{ backgroundColor: w.color }}
            title={shortenAddress(w.address)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Wallets
        </p>
        <span className="text-[10px] text-muted-foreground">
          {wallets.length}/10
        </span>
      </div>

      {/* Add wallet input */}
      <div className="flex gap-1.5">
        <Input
          placeholder="0x... or Solana address"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          className="h-7 flex-1 font-mono text-xs"
        />
        <Button size="sm" onClick={handleAdd} disabled={!input.trim()}>
          Add
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {detectedType && !error && (
        <p className="text-[10px] text-muted-foreground">
          Detected: {detectedType === 'evm' ? 'EVM wallet' : 'Solana wallet'}
        </p>
      )}

      {/* Wallet list */}
      <div className="flex flex-col gap-1">
        {wallets.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No wallets added yet
          </p>
        )}

        {wallets.map((wallet) => (
          <div
            key={wallet.address}
            className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: wallet.color }}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-xs text-foreground">
                {shortenAddress(wallet.address)}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                {wallet.type === 'solana' ? '◎ Solana' : wallet.label || 'EVM'}
              </span>
            </div>

            <Switch
              checked={wallet.enabled}
              onCheckedChange={() => toggleWallet(wallet.address)}
            />

            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => removeWallet(wallet.address)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
