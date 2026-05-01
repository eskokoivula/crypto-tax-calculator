import { NextRequest, NextResponse } from 'next/server';

// This runs the SAME code path as the client-side pipeline but server-side
// to verify data flows correctly

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';

export async function GET(request: NextRequest) {
  const apiKey = process.env.MORALIS_API_KEY!;
  const address = request.nextUrl.searchParams.get('address') || '0x18e6c263ecd40ad31d9079b20730f04a59dd73b0';
  const chain = '0x1';
  const log: string[] = [];

  // Step 1: Fetch EUR rates
  let eurRate = 0.87;
  try {
    const ratesRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    const ratesData = await ratesRes.json();
    eurRate = ratesData.rates?.EUR ?? 0.87;
    log.push(`EUR rate: ${eurRate}`);
  } catch (e) {
    log.push(`EUR rate FAILED: ${e}`);
  }

  // Step 2: Fetch history
  const historyRes = await fetch(
    `${MORALIS_BASE}/wallets/${address}/history?chain=${chain}&from_date=2025-01-01&to_date=2025-12-31&limit=20&include_internal_transactions=true`,
    { headers: { 'X-API-Key': apiKey, accept: 'application/json' } },
  );
  const historyData = await historyRes.json();
  const historyItems = historyData.result || [];
  log.push(`History items: ${historyItems.length}`);

  // Step 3: Transform — simulate what pipeline.ts does
  const transactions: any[] = [];
  for (const item of historyItems) {
    // Skip failed
    if (String(item.receipt_status) === '0') { log.push(`SKIP receipt_status=0: ${item.hash?.slice(0,10)}`); continue; }
    // Skip spam
    if (item.possible_spam === true || item.possible_spam === 'true') { log.push(`SKIP spam: ${item.hash?.slice(0,10)}`); continue; }

    const erc20 = item.erc20_transfers || [];
    const native = item.native_transfers || [];

    for (const t of erc20) {
      if (t.possible_spam === true || t.possible_spam === 'true') continue;
      // Spam name check
      const name = t.token_name || '';
      if (/\.(com|net|org|io)|https?:\/\/|www\./i.test(name)) continue;
      if (/visit\s*website|claim|reward|airdrop/i.test(name)) continue;
      if (name.length > 50) continue;

      const val = parseFloat(t.value_formatted || '0');
      if (val === 0) continue;

      transactions.push({
        token: t.token_symbol,
        amount: val,
        type: 'erc20',
        timestamp: item.block_timestamp,
      });
    }

    for (const t of native) {
      const val = parseFloat(t.value_formatted || '0');
      if (val === 0) continue;

      transactions.push({
        token: t.token_symbol || 'ETH',
        amount: val,
        type: 'native',
        timestamp: item.block_timestamp,
      });
    }

    // Fallback: tx-level value
    if (erc20.length === 0 && native.length === 0) {
      const val = BigInt(item.value || '0');
      if (val > BigInt(0)) {
        transactions.push({
          token: 'ETH',
          amount: Number(val) / 1e18,
          type: 'tx-value',
          timestamp: item.block_timestamp,
        });
      }
    }
  }

  log.push(`Transactions created: ${transactions.length}`);

  // Step 4: Fetch balances
  const balRes = await fetch(
    `${MORALIS_BASE}/wallets/${address}/tokens?chain=${chain}&exclude_spam=true`,
    { headers: { 'X-API-Key': apiKey, accept: 'application/json' } },
  );
  const balData = await balRes.json();
  const tokens = Array.isArray(balData) ? balData : balData.result || [];

  const balances = tokens.slice(0, 10).map((t: any) => ({
    symbol: t.symbol,
    balance: t.balance_formatted,
    usdPrice: typeof t.usd_price === 'string' ? parseFloat(t.usd_price) : t.usd_price,
    eurValue: (parseFloat(t.balance_formatted || '0')) * (typeof t.usd_price === 'string' ? parseFloat(t.usd_price) : (t.usd_price || 0)) * eurRate,
  }));

  log.push(`Balances with value: ${balances.filter((b: any) => b.eurValue > 0).length}/${balances.length}`);

  return NextResponse.json({
    log,
    transactionCount: transactions.length,
    transactions: transactions.slice(0, 10),
    balanceSample: balances.slice(0, 5),
    eurRate,
  });
}
