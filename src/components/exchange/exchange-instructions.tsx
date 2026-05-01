"use client";

import { EXCHANGE_INSTRUCTIONS } from '@/lib/exchange/instructions';
import { ExternalLinkIcon, AlertTriangleIcon } from 'lucide-react';

interface ExchangeInstructionsProps {
  exchange: string;
  mode: 'csv' | 'api';
}

export function ExchangeInstructions({ exchange, mode }: ExchangeInstructionsProps) {
  const instruction = EXCHANGE_INSTRUCTIONS[exchange];

  if (!instruction) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No instructions available for this exchange.
      </div>
    );
  }

  const steps = mode === 'csv' ? instruction.csvSteps : instruction.apiSteps;
  const url = mode === 'csv' ? instruction.csvUrl : instruction.apiKeyUrl;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{instruction.logo}</span>
        <h3 className="font-medium text-sm">
          {instruction.exchange} - {mode === 'csv' ? 'CSV Export' : 'API Setup'}
        </h3>
      </div>

      {/* Steps */}
      <ol className="space-y-2 text-sm">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex-none flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {index + 1}
            </span>
            <span className="text-muted-foreground leading-5">{step}</span>
          </li>
        ))}
      </ol>

      {/* Required Permissions */}
      {mode === 'api' && instruction.requiredPermissions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangleIcon className="size-4" />
            Required Permissions
          </div>
          <ul className="mt-1.5 ml-6 list-disc text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
            {instruction.requiredPermissions.map((perm, i) => (
              <li key={i}>{perm}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {instruction.notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
          <ul className="space-y-1">
            {instruction.notes.map((note, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="flex-none mt-0.5 size-1 rounded-full bg-muted-foreground/40" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link */}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Open {instruction.exchange}
          <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </div>
  );
}
