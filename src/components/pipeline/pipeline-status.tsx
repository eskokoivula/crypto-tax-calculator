"use client";

import { useTransactionStore } from '@/store/transaction-store';
import { shortenAddress } from '@/lib/utils';
import { Loader2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PipelineStatusProps {
  onAbort: () => void;
}

const STEPS = [
  'Fetching',
  'Processing',
  'Computing taxes',
  'Done',
] as const;

function getStepIndex(status: string): number {
  const lower = status.toLowerCase();
  if (lower.includes('exchange rate') || lower.includes('fetching') || lower.includes('detecting')) {
    return 0;
  }
  if (lower.includes('processing') || lower.includes('dedup')) {
    return 1;
  }
  if (lower.includes('cost basis') || lower.includes('fifo') || lower.includes('warning') || lower.includes('computing')) {
    return 2;
  }
  return 0;
}

export function PipelineStatus({ onAbort }: PipelineStatusProps) {
  const { loading, progress } = useTransactionStore();

  if (!loading) return null;

  const currentStep = progress ? getStepIndex(progress.status) : 0;
  const progressPercent = Math.min(((currentStep + 1) / STEPS.length) * 100, 95);

  const walletLabel = progress?.currentWallet
    ? shortenAddress(progress.currentWallet)
    : '';
  const chainLabel = progress?.currentChain || '';

  const statusText = progress?.status || 'Initializing...';

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {walletLabel && chainLabel
                ? `Scanning ${walletLabel} on ${chainLabel}...`
                : walletLabel
                  ? `Scanning ${walletLabel}...`
                  : statusText}
            </p>
            {(walletLabel || chainLabel) && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {statusText}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onAbort}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="mt-2 flex justify-between">
        {STEPS.map((step, i) => (
          <span
            key={step}
            className={`text-[10px] font-medium transition-colors ${
              i <= currentStep
                ? 'text-primary'
                : 'text-muted-foreground/50'
            }`}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
