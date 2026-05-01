/**
 * FIFO (First In, First Out) cost basis engine.
 *
 * Maintains acquisition lots per token and consumes them in chronological order
 * when disposals occur. This is the standard method accepted by Finnish tax
 * authorities (Vero) for crypto asset cost basis calculation.
 */

import type { CostBasisLot } from '@/types';
import type { CostBasisLotInput, FIFOConsumeResult, MissingCostBasisEntry } from './types';

export class FIFOEngine {
  private lots: Map<string, CostBasisLot[]>;
  private missingBasis: Map<string, MissingCostBasisEntry>;

  constructor() {
    this.lots = new Map();
    this.missingBasis = new Map();
  }

  /**
   * Add an acquisition lot for a token.
   * Sets `remaining` equal to `amount` (full lot is available).
   * Lots are kept sorted by acquisition date (oldest first).
   */
  addLot(input: CostBasisLotInput): void {
    const lot: CostBasisLot = {
      ...input,
      remaining: input.amount,
    };

    const symbol = input.token.toUpperCase();
    const existing = this.lots.get(symbol);

    if (existing) {
      existing.push(lot);
      existing.sort(
        (a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime(),
      );
    } else {
      this.lots.set(symbol, [lot]);
    }
  }

  /**
   * Consume tokens from the oldest available lots (FIFO order).
   *
   * @param tokenSymbol - The token being disposed of
   * @param amount - The amount being disposed
   * @param disposalDate - The date of disposal (used for holding period calculation)
   * @returns Cost basis information, or null if no lots are available at all
   */
  consume(
    tokenSymbol: string,
    amount: number,
    disposalDate: Date,
  ): FIFOConsumeResult | null {
    const symbol = tokenSymbol.toUpperCase();
    const tokenLots = this.lots.get(symbol);

    if (!tokenLots || tokenLots.length === 0) {
      this.trackMissingBasis(symbol, amount, disposalDate);
      return null;
    }

    let remaining = amount;
    let totalCostBasis = 0;
    let totalFees = 0;
    let weightedHoldingDays = 0;
    let totalConsumed = 0;
    const lotsUsed: { lot: CostBasisLot; amountUsed: number }[] = [];

    for (const lot of tokenLots) {
      if (remaining <= 0) break;
      if (lot.remaining <= 0) continue;

      const consumed = Math.min(lot.remaining, remaining);
      const costForPortion = consumed * lot.costEurPerUnit;
      // Prorate fees proportionally to how much of the lot is consumed
      const feeForPortion =
        lot.totalCostEur > 0
          ? (consumed / lot.amount) * (lot.totalCostEur - lot.amount * lot.costEurPerUnit)
          : 0;

      const holdingDays = Math.floor(
        (disposalDate.getTime() - lot.acquisitionDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      totalCostBasis += costForPortion;
      totalFees += Math.max(0, feeForPortion);
      weightedHoldingDays += holdingDays * consumed;
      totalConsumed += consumed;

      lot.remaining -= consumed;
      remaining -= consumed;

      lotsUsed.push({ lot, amountUsed: consumed });
    }

    // If we couldn't fully cover the disposal, track the shortfall
    if (remaining > 0) {
      this.trackMissingBasis(symbol, remaining, disposalDate);
    }

    if (totalConsumed === 0) {
      return null;
    }

    const avgHoldingDays = totalConsumed > 0 ? Math.round(weightedHoldingDays / totalConsumed) : 0;

    return {
      costBasisEur: totalCostBasis,
      feesEur: totalFees,
      holdingPeriodDays: avgHoldingDays,
      lotsUsed,
    };
  }

  /**
   * Return tokens where disposals could not find matching acquisition lots.
   */
  getMissingCostBasis(): MissingCostBasisEntry[] {
    return Array.from(this.missingBasis.values());
  }

  /**
   * Get all lots for a specific token.
   */
  getLots(tokenSymbol: string): CostBasisLot[] {
    return this.lots.get(tokenSymbol.toUpperCase()) ?? [];
  }

  /**
   * Get all lots across all tokens.
   */
  getAllLots(): Map<string, CostBasisLot[]> {
    return new Map(this.lots);
  }

  /**
   * Reset the engine, clearing all lots and missing basis records.
   */
  reset(): void {
    this.lots.clear();
    this.missingBasis.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private trackMissingBasis(symbol: string, amount: number, date: Date): void {
    const existing = this.missingBasis.get(symbol);
    if (existing) {
      existing.amount += amount;
      if (date < existing.earliestDate) {
        existing.earliestDate = date;
      }
    } else {
      this.missingBasis.set(symbol, {
        token: symbol,
        amount,
        earliestDate: date,
      });
    }
  }
}
