/**
 * Capital gains calculation for Finnish tax (Vero).
 *
 * Implements:
 * - Actual cost basis method (todellinen hankintameno)
 * - Deemed cost method / hankintameno-olettama (20% or 40%)
 * - Progressive capital gains tax rates (30% / 34%)
 */

import { FINNISH_TAX } from '@/types';
import type { GainCalculationResult, TaxLiabilityResult } from './types';

/**
 * Calculate the capital gain for a single disposal, comparing actual cost
 * basis against the deemed acquisition cost (hankintameno-olettama).
 *
 * Finnish tax law allows taxpayers to use whichever method results in a
 * lower taxable gain:
 * - Actual: proceeds - costBasis - fees
 * - Deemed: proceeds - (proceeds * 20%) for holdings < 10 years
 *           proceeds - (proceeds * 40%) for holdings >= 10 years
 *
 * @param proceedsEur - Sale proceeds in EUR
 * @param costBasisEur - FIFO cost basis in EUR
 * @param feesEur - Transaction fees (gas + exchange) in EUR
 * @param holdingPeriodDays - Number of days the asset was held
 */
export function calculateGain(
  proceedsEur: number,
  costBasisEur: number,
  feesEur: number,
  holdingPeriodDays: number,
): GainCalculationResult {
  const actualGain = proceedsEur - costBasisEur - feesEur;

  const yearsHeld = holdingPeriodDays / 365;
  const deemedCostPercentage =
    yearsHeld >= FINNISH_TAX.DEEMED_COST_YEARS_THRESHOLD
      ? FINNISH_TAX.DEEMED_COST_LONG * 100
      : FINNISH_TAX.DEEMED_COST_SHORT * 100;

  const deemedCostGain = proceedsEur - proceedsEur * (deemedCostPercentage / 100);

  // Use deemed cost only if it results in a lower (more favorable) gain.
  // Note: for losses (actualGain < 0), actual cost is always more favorable
  // since deemed cost always produces a non-negative gain.
  const useDeemedCost = deemedCostGain < actualGain;
  const finalGain = useDeemedCost ? deemedCostGain : actualGain;

  return {
    actualGain,
    deemedCostGain,
    useDeemedCost,
    finalGain,
    deemedCostPercentage,
  };
}

/**
 * Calculate total Finnish capital gains tax liability.
 *
 * Finnish capital gains tax rates (2025):
 * - 30% on the first 30,000 EUR of capital income
 * - 34% on capital income exceeding 30,000 EUR
 *
 * @param totalGainsEur - Total taxable capital gains in EUR (gains + income)
 */
export function calculateTaxLiability(totalGainsEur: number): TaxLiabilityResult {
  if (totalGainsEur <= 0) {
    return {
      taxAmount: 0,
      effectiveRate: 0,
      breakdown: [
        {
          bracket: 'No taxable gains',
          amount: 0,
          rate: 0,
          tax: 0,
        },
      ],
    };
  }

  const {
    CAPITAL_GAINS_RATE_LOW,
    CAPITAL_GAINS_RATE_HIGH,
    CAPITAL_GAINS_THRESHOLD,
  } = FINNISH_TAX;

  const breakdown: { bracket: string; amount: number; rate: number; tax: number }[] = [];

  const lowerAmount = Math.min(totalGainsEur, CAPITAL_GAINS_THRESHOLD);
  const lowerTax = lowerAmount * CAPITAL_GAINS_RATE_LOW;
  breakdown.push({
    bracket: `0 - ${CAPITAL_GAINS_THRESHOLD.toLocaleString('fi-FI')} EUR`,
    amount: lowerAmount,
    rate: CAPITAL_GAINS_RATE_LOW,
    tax: lowerTax,
  });

  let upperTax = 0;
  if (totalGainsEur > CAPITAL_GAINS_THRESHOLD) {
    const upperAmount = totalGainsEur - CAPITAL_GAINS_THRESHOLD;
    upperTax = upperAmount * CAPITAL_GAINS_RATE_HIGH;
    breakdown.push({
      bracket: `> ${CAPITAL_GAINS_THRESHOLD.toLocaleString('fi-FI')} EUR`,
      amount: upperAmount,
      rate: CAPITAL_GAINS_RATE_HIGH,
      tax: upperTax,
    });
  }

  const taxAmount = lowerTax + upperTax;
  const effectiveRate = totalGainsEur > 0 ? taxAmount / totalGainsEur : 0;

  return {
    taxAmount,
    effectiveRate,
    breakdown,
  };
}
