/**
 * Warning rules engine.
 *
 * Analyzes transactions and FIFO state to generate actionable warnings
 * for the user's tax report.
 */

import type { Transaction, Warning } from '@/types';
import type { FIFOEngine } from '@/lib/tax/fifo';
import { generateId } from '@/lib/utils';

/** Threshold in EUR above which a disposal triggers an informational warning. */
const LARGE_DISPOSAL_THRESHOLD_EUR = 10_000;

/**
 * Generate warnings for a set of transactions and the current FIFO engine state.
 *
 * Rules checked:
 * 1. Missing cost basis (error) — disposals without acquisition lots
 * 2. Large disposals > 10,000 EUR (info) — may need extra documentation
 * 3. Deemed cost more favorable (info) — hankintameno-olettama was used
 * 4. Possible duplicates (warning) — transactions with existing duplicate warnings
 * 5. Unknown category / transfer with value (warning) — may need manual review
 */
export function generateWarnings(
  transactions: Transaction[],
  fifo: FIFOEngine,
): Warning[] {
  const warnings: Warning[] = [];

  // --- Rule 1: Missing cost basis from FIFO engine ---
  const missingBasis = fifo.getMissingCostBasis();
  for (const entry of missingBasis) {
    warnings.push({
      id: generateId(),
      severity: 'error',
      message: `Missing cost basis for ${entry.amount.toFixed(4)} ${entry.token}. Earliest disposal: ${entry.earliestDate.toISOString().slice(0, 10)}. Add acquisition data or import exchange history.`,
      dismissed: false,
    });
  }

  // --- Per-transaction rules ---
  for (const tx of transactions) {
    const effectiveCategory = tx.categoryOverride ?? tx.category;

    // Rule 2: Large disposals
    if (effectiveCategory === 'disposal' && tx.valueEur > LARGE_DISPOSAL_THRESHOLD_EUR) {
      warnings.push({
        id: generateId(),
        severity: 'info',
        message: `Large disposal of ${tx.amountFormatted.toFixed(4)} ${tx.tokenSymbol} worth ${tx.valueEur.toFixed(2)} EUR. Ensure cost basis is accurate.`,
        transactionId: tx.id,
        dismissed: false,
      });
    }

    // Rule 3: Deemed cost used
    if (tx.usedDeemedCost) {
      warnings.push({
        id: generateId(),
        severity: 'info',
        message: `Deemed acquisition cost (hankintameno-olettama) used for ${tx.tokenSymbol} disposal — more favorable than actual cost basis.`,
        transactionId: tx.id,
        dismissed: false,
      });
    }

    // Rule 4: Missing cost basis on specific disposal
    if (effectiveCategory === 'disposal' && tx.costBasisEur == null) {
      warnings.push({
        id: generateId(),
        severity: 'error',
        message: `No cost basis found for disposal of ${tx.amountFormatted.toFixed(4)} ${tx.tokenSymbol}. Tax cannot be accurately calculated.`,
        transactionId: tx.id,
        dismissed: false,
      });
    }

    // Rule 5: Already-flagged possible duplicates (from dedup)
    const hasDupWarning = tx.warnings.some((w) => w.message.includes('Possible duplicate'));
    if (hasDupWarning) {
      // Already has a warning from dedup, skip adding another
      continue;
    }

    // Rule 6: Unknown/unclear category — transfer with significant value
    if (effectiveCategory === 'transfer' && !tx.isInternalTransfer && tx.valueEur > 100) {
      warnings.push({
        id: generateId(),
        severity: 'warning',
        message: `Transaction categorized as transfer but has value of ${tx.valueEur.toFixed(2)} EUR. Review if this should be a disposal or income.`,
        transactionId: tx.id,
        dismissed: false,
      });
    }
  }

  return warnings;
}
