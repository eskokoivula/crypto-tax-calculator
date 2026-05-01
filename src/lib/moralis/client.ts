/**
 * HTTP client for the Moralis Web3 Data API v2.2.
 *
 * Features:
 * - Typed GET / POST helpers
 * - Exponential-backoff retry (3 attempts, 1 s base)
 * - 429 rate-limit handling (respects Retry-After header)
 * - Cursor-based auto-pagination via `getAllPages()`
 */

const BASE_URL = 'https://deep-index.moralis.io/api/v2.2';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class MoralisApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'MoralisApiError';
  }
}

export class MoralisRateLimitError extends MoralisApiError {
  constructor(
    public readonly retryAfterMs: number,
    responseBody: string,
  ) {
    super('Moralis API rate limit exceeded', 429, responseBody);
    this.name = 'MoralisRateLimitError';
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.MORALIS_API_KEY;
  if (!key) {
    throw new Error(
      'MORALIS_API_KEY is not set. Add it to your environment variables.',
    );
  }
  return key;
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<T> {
  const response = await fetch(url, init);

  // --- Rate limit ---
  if (response.status === 429) {
    if (attempt >= MAX_RETRIES) {
      const body = await response.text();
      throw new MoralisRateLimitError(0, body);
    }
    const retryAfterHeader = response.headers.get('Retry-After');
    const waitMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1_000
      : BASE_DELAY_MS * 2 ** attempt;
    await sleep(waitMs);
    return request<T>(url, init, attempt + 1);
  }

  // --- Retryable server errors ---
  if (response.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(BASE_DELAY_MS * 2 ** attempt);
    return request<T>(url, init, attempt + 1);
  }

  // --- Non-success ---
  if (!response.ok) {
    const body = await response.text();
    throw new MoralisApiError(
      `Moralis API error ${response.status}: ${body}`,
      response.status,
      body,
    );
  }

  return response.json() as Promise<T>;
}

function headers(): Record<string, string> {
  return {
    accept: 'application/json',
    'X-API-Key': getApiKey(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Typed GET request against the Moralis API.
 *
 * @param path   - API path (e.g. `/wallets/0x.../chains`). Interpolate path params before calling.
 * @param params - Query parameters. `undefined` values are omitted.
 */
export async function get<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);
  return request<T>(url, { method: 'GET', headers: headers() });
}

/**
 * Typed POST request against the Moralis API.
 *
 * @param path   - API path (e.g. `/erc20/prices`).
 * @param body   - JSON-serialisable request body.
 * @param params - Query parameters.
 */
export async function post<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);
  return request<T>(url, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auto-pagination
// ---------------------------------------------------------------------------

/** Shape of any paginated Moralis response. */
interface PaginatedResponse<T> {
  result: T[];
  cursor: string | null;
}

export interface PaginationOptions {
  /** Maximum total items to collect across all pages (default: unlimited). */
  maxItems?: number;
}

/**
 * Automatically paginate a cursor-based Moralis GET endpoint.
 *
 * @param path    - API path with path params already interpolated.
 * @param params  - Query parameters (cursor will be managed automatically).
 * @param options - Optional pagination limits.
 * @returns All `result` items collected across every page.
 */
export async function getAllPages<T>(
  path: string,
  params?: Record<string, string | undefined>,
  options?: PaginationOptions,
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;

  do {
    const pageParams = { ...params, ...(cursor ? { cursor } : {}) };
    const page = await get<PaginatedResponse<T>>(path, pageParams);

    allItems.push(...page.result);

    if (options?.maxItems && allItems.length >= options.maxItems) {
      return allItems.slice(0, options.maxItems);
    }

    cursor = page.cursor ?? undefined;
  } while (cursor);

  return allItems;
}
