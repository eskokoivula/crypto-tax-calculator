/**
 * Tax-engine-specific types that supplement the main types file.
 */

import type { CostBasisLot, ExchangeSource } from '@/types';

/** Result of a FIFO consumption operation. */
export interface FIFOConsumeResult {
  costBasisEur: number;
  feesEur: number;
  holdingPeriodDays: number;
  lotsUsed: { lot: CostBasisLot; amountUsed: number }[];
}

/** Tracks tokens where disposals could not find matching acquisition lots. */
export interface MissingCostBasisEntry {
  token: string;
  amount: number;
  earliestDate: Date;
}

/** Result of the capital gains calculation for a single disposal. */
export interface GainCalculationResult {
  actualGain: number;
  deemedCostGain: number;
  useDeemedCost: boolean;
  finalGain: number;
  deemedCostPercentage: number;
}

/** Breakdown of a single tax bracket in the liability calculation. */
export interface TaxBracket {
  bracket: string;
  amount: number;
  rate: number;
  tax: number;
}

/** Result of the full tax liability calculation. */
export interface TaxLiabilityResult {
  taxAmount: number;
  effectiveRate: number;
  breakdown: TaxBracket[];
}

/** Input for adding a cost basis lot (without the computed `remaining` field). */
export type CostBasisLotInput = Omit<CostBasisLot, 'remaining'>;

/** DEX router addresses commonly seen in swap transactions. */
export const DEX_ROUTER_LABELS = [
  'uniswap',
  'sushiswap',
  'pancakeswap',
  '1inch',
  'paraswap',
  '0x',
  'curve',
  'balancer',
  'trader joe',
  'quickswap',
  'velodrome',
  'aerodrome',
] as const;

/** Keywords in Moralis summaries that indicate a disposal (swap/sell). */
export const DISPOSAL_KEYWORDS = [
  'swapped',
  'sold',
  'swap',
  'exchange',
] as const;

/** Keywords in Moralis summaries that indicate receiving tokens. */
export const RECEIVE_KEYWORDS = [
  'received',
  'claimed',
  'harvested',
] as const;
