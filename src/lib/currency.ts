const FRANKFURTER_BASE = 'https://api.frankfurter.app';

/** In-memory cache for exchange rates keyed by YYYY-MM-DD */
const rateCache = new Map<string, number>();

function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the USD → EUR exchange rate for a specific date.
 * For weekends/holidays, frankfurter returns the nearest business day rate.
 */
export async function getHistoricalRate(date: Date): Promise<number> {
  const dateStr = formatDateForApi(date);

  const cached = rateCache.get(dateStr);
  if (cached !== undefined) return cached;

  const response = await fetch(
    `${FRANKFURTER_BASE}/${dateStr}?from=USD&to=EUR`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch exchange rate for ${dateStr}: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const rate: number = data.rates.EUR;

  rateCache.set(dateStr, rate);
  return rate;
}

/** Get the latest USD → EUR exchange rate. */
export async function getLatestRate(): Promise<number> {
  const cached = rateCache.get('latest');
  if (cached !== undefined) return cached;

  const response = await fetch(`${FRANKFURTER_BASE}/latest?from=USD&to=EUR`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest exchange rate: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const rate: number = data.rates.EUR;

  // Cache under both 'latest' and the actual date returned
  rateCache.set('latest', rate);
  if (data.date) {
    rateCache.set(data.date, rate);
  }

  return rate;
}

/**
 * Batch-fetch rates for a date range using the frankfurter time-series endpoint.
 * Returns a Map keyed by YYYY-MM-DD with the USD → EUR rate for each business day
 * in the range. All returned rates are cached.
 */
export async function getRatesForDateRange(
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const fromStr = formatDateForApi(from);
  const toStr = formatDateForApi(to);

  const response = await fetch(
    `${FRANKFURTER_BASE}/${fromStr}..${toStr}?from=USD&to=EUR`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch exchange rates for ${fromStr}..${toStr}: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const result = new Map<string, number>();

  // Time-series response: { rates: { "2024-01-02": { EUR: 0.91 }, ... } }
  if (data.rates && typeof data.rates === 'object') {
    for (const [dateKey, currencies] of Object.entries(data.rates)) {
      const rate = (currencies as Record<string, number>).EUR;
      if (rate !== undefined) {
        rateCache.set(dateKey, rate);
        result.set(dateKey, rate);
      }
    }
  }

  return result;
}

/** Convert a USD amount to EUR using a pre-fetched rate. */
export function usdToEur(usdAmount: number, rate: number): number {
  return usdAmount * rate;
}

/** Clear the in-memory rate cache (useful for testing). */
export function clearRateCache(): void {
  rateCache.clear();
}
