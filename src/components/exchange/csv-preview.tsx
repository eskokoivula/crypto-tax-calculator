"use client";

import type { ParsedTransaction } from '@/lib/exchange/types';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';

interface CsvPreviewProps {
  transactions: ParsedTransaction[];
  errors?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  buy: 'default',
  sell: 'destructive',
  deposit: 'secondary',
  withdrawal: 'secondary',
  trade: 'outline',
  staking_reward: 'default',
  airdrop: 'default',
  fee: 'destructive',
  other: 'outline',
};

export function CsvPreview({ transactions, errors, onConfirm, onCancel }: CsvPreviewProps) {
  const preview = transactions.slice(0, 10);
  const remaining = transactions.length - preview.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="size-4 text-emerald-500" />
        <span className="text-sm font-medium">
          Parsed {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Errors/Warnings */}
      {errors && errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangleIcon className="size-4" />
            {errors.length} warning{errors.length !== 1 ? 's' : ''}
          </div>
          {errors.slice(0, 3).map((err, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-300 ml-6">{err}</p>
          ))}
          {errors.length > 3 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 ml-6">
              ...and {errors.length - 3} more
            </p>
          )}
        </div>
      )}

      {/* Table Preview */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((tx, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">
                  {formatDateTime(tx.date)}
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[tx.type] || 'outline'}>
                    {tx.type.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {tx.tokenSymbol}
                  {tx.counterTokenSymbol && (
                    <span className="text-muted-foreground">
                      {' / '}{tx.counterTokenSymbol}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {tx.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {tx.feeAmount
                    ? `${tx.feeAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${tx.feeCurrency || ''}`
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {remaining > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          ...and {remaining} more transaction{remaining !== 1 ? 's' : ''}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>
          Import {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
