"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, isValidWalletAddress, shortenAddress } from "@/lib/utils";
import { useWalletStore } from "@/store/wallet-store";
import {
  XIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  Loader2Icon,
  WalletIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

const TOTAL_STEPS = 5;

const EXCHANGES = [
  { id: "binance", name: "Binance", letter: "B" },
  { id: "crypto.com", name: "Crypto.com", letter: "C" },
  { id: "revolut", name: "Revolut", letter: "R" },
  { id: "bybit", name: "Bybit", letter: "Y" },
] as const;

interface OnboardingWizardProps {
  onComplete: () => void;
  onDismiss: () => void;
}

interface WalletEntry {
  address: string;
  type: 'evm' | 'solana';
}

export function OnboardingWizard({ onComplete, onDismiss }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [walletInput, setWalletInput] = useState("");
  const [walletError, setWalletError] = useState("");
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { addWallet, setTaxYear } = useWalletStore();

  const detectedType = walletInput.trim() ? isValidWalletAddress(walletInput.trim()) : null;

  function handleAddWallet() {
    const address = walletInput.trim();
    setWalletError("");

    const type = isValidWalletAddress(address);
    if (!type) {
      setWalletError("Invalid address. Supports EVM (0x...) and Solana");
      return;
    }

    const normalized = type === 'evm' ? address.toLowerCase() : address;
    if (walletEntries.some((w) => w.address === normalized)) {
      setWalletError("Wallet already in the list");
      return;
    }

    if (walletEntries.length >= 10) {
      setWalletError("Maximum 10 wallets");
      return;
    }

    setWalletEntries([...walletEntries, { address: normalized, type }]);
    setWalletInput("");
  }

  function handleRemoveWallet(address: string) {
    setWalletEntries(walletEntries.filter((w) => w.address !== address));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddWallet();
  }

  function handleNext() {
    if (step === 2) {
      if (walletEntries.length === 0) {
        setWalletError("Add at least one wallet");
        return;
      }
      walletEntries.forEach((w) => addWallet(w.address));
    }
    if (step === 3 && selectedYear) {
      setTaxYear(selectedYear);
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  useEffect(() => {
    if (step === 5) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, onComplete]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 text-muted-foreground"
        onClick={onDismiss}
      >
        <XIcon className="size-5" />
      </Button>

      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 px-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "size-2 rounded-full transition-colors",
                i + 1 === step
                  ? "bg-primary"
                  : i + 1 < step
                    ? "bg-primary/50"
                    : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex min-h-[380px] w-full flex-col items-center justify-center gap-6 text-center">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <span className="text-3xl">&#127467;&#127470;</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Tervetuloa! / Welcome!
                </h1>
                <p className="text-muted-foreground">
                  This app helps you calculate crypto taxes for Finnish tax
                  reporting (Vero).
                </p>
              </div>
              <div className="space-y-3 rounded-xl border border-border/50 bg-card p-4 text-left text-sm text-muted-foreground">
                <p>
                  We will scan your wallet transactions across{" "}
                  <span className="font-medium text-foreground">
                    all major EVM chains + Solana
                  </span>{" "}
                  and generate{" "}
                  <span className="font-medium text-foreground">
                    Lomake 9
                  </span>{" "}
                  forms for capital gains reporting.
                </p>
                <p>
                  Supported chains: Ethereum, Polygon, Base, BNB, Arbitrum, Optimism,
                  Avalanche, Fantom, Cronos, Linea, Sonic, Sei, Solana & more.
                </p>
              </div>
            </>
          )}

          {/* Step 2: Add wallets (multiple!) */}
          {step === 2 && (
            <>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <WalletIcon className="size-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Add your wallets
                </h2>
                <p className="text-sm text-muted-foreground">
                  Paste EVM (0x...) or Solana addresses. Add up to 10 wallets.
                </p>
              </div>

              {/* Input row */}
              <div className="w-full space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="0x... or Solana address"
                    value={walletInput}
                    onChange={(e) => {
                      setWalletInput(e.target.value);
                      setWalletError("");
                    }}
                    onKeyDown={handleKeyDown}
                    className="h-10 flex-1 font-mono text-sm"
                  />
                  <Button
                    onClick={handleAddWallet}
                    disabled={!walletInput.trim()}
                    size="sm"
                    className="h-10 gap-1"
                  >
                    <PlusIcon className="size-4" />
                    Add
                  </Button>
                </div>

                {walletError && (
                  <p className="text-xs text-destructive">{walletError}</p>
                )}
                {detectedType && !walletError && walletInput.trim() && (
                  <p className="flex items-center justify-center gap-1 text-xs text-emerald-500">
                    <CheckIcon className="size-3" />
                    {detectedType === 'evm' ? 'EVM address detected' : 'Solana address detected'}
                  </p>
                )}
              </div>

              {/* Added wallets list */}
              {walletEntries.length > 0 && (
                <div className="w-full space-y-1.5">
                  <p className="text-left text-xs text-muted-foreground">
                    {walletEntries.length} wallet{walletEntries.length !== 1 ? 's' : ''} added:
                  </p>
                  <div className="max-h-[160px] overflow-y-auto rounded-lg border border-border/50 bg-card">
                    {walletEntries.map((entry, i) => (
                      <div
                        key={entry.address}
                        className="flex items-center gap-2 border-b border-border/30 px-3 py-2 last:border-b-0"
                      >
                        <span className="text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="flex-1 truncate font-mono text-xs text-foreground">
                          {shortenAddress(entry.address)}
                        </span>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          entry.type === 'solana'
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-blue-500/10 text-blue-400"
                        )}>
                          {entry.type === 'solana' ? 'SOL' : 'EVM'}
                        </span>
                        <button
                          onClick={() => handleRemoveWallet(entry.address)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 3: Tax year */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Select tax year
                </h2>
                <p className="text-sm text-muted-foreground">
                  Which tax year are you reporting?
                </p>
              </div>
              <div className="flex gap-3">
                {[2023, 2024, 2025].map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={cn(
                      "flex h-20 w-24 flex-col items-center justify-center rounded-xl border-2 text-lg font-bold transition-all",
                      selectedYear === year
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Exchange imports */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Do you have exchange accounts?
                </h2>
                <p className="text-sm text-muted-foreground">
                  You can add these later too
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                {EXCHANGES.map((ex) => (
                  <button
                    key={ex.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-lg font-bold text-foreground">
                      {ex.letter}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {ex.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 5: Scanning */}
          {step === 5 && (
            <>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2Icon className="size-8 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  Scanning your wallets...
                </h2>
                <p className="text-sm text-muted-foreground">
                  Auto-detecting chains and fetching transactions. This may take a moment.
                </p>
              </div>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                <div className="h-full animate-pulse rounded-full bg-primary" style={{ width: "60%" }} />
              </div>
            </>
          )}
        </div>

        {/* Navigation buttons */}
        {step < 5 && (
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              onClick={step === 1 ? onDismiss : handleBack}
              className="gap-1.5"
            >
              {step === 1 ? (
                "Skip"
              ) : (
                <>
                  <ArrowLeftIcon className="size-4" />
                  Back
                </>
              )}
            </Button>

            <Button
              onClick={handleNext}
              disabled={step === 2 && walletEntries.length === 0}
              className="gap-1.5"
            >
              {step === 4 ? "Finish" : "Next"}
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
