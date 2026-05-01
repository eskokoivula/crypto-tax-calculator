import { NextRequest, NextResponse } from 'next/server';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';
const SOLANA_BASE = 'https://solana-gateway.moralis.io';

export async function GET(request: NextRequest) {
  const apiKey = process.env.MORALIS_API_KEY;
  const address = request.nextUrl.searchParams.get('address') || '0x18e6c263ecd40ad31d9079b20730f04a59dd73b0';
  const log: string[] = [];

  function addLog(msg: string) {
    log.push(msg);
    console.log(`[DEBUG] ${msg}`);
  }

  addLog(`Starting pipeline debug for ${address}`);
  addLog(`API key present: ${!!apiKey}, length: ${apiKey?.length}`);

  try {
    // Step 1: Detect chains
    addLog('--- STEP 1: Detect chains ---');
    const chainsRes = await fetch(`${MORALIS_BASE}/wallets/${address}/chains`, {
      headers: { 'X-API-Key': apiKey!, accept: 'application/json' },
    });
    const chainsData = await chainsRes.json();
    const activeChains = chainsData.active_chains || [];
    addLog(`Chains response status: ${chainsRes.status}`);
    addLog(`Active chains: ${JSON.stringify(activeChains.map((c: any) => c.chain_id))}`);

    // Step 2: Fetch history for first chain
    addLog('--- STEP 2: Fetch history (2025, first chain) ---');
    const chain = activeChains[0]?.chain_id || '0x1';
    const historyRes = await fetch(
      `${MORALIS_BASE}/wallets/${address}/history?chain=${chain}&from_date=2025-01-01&to_date=2025-12-31&limit=10&include_internal_transactions=true&nft_metadata=true`,
      { headers: { 'X-API-Key': apiKey!, accept: 'application/json' } },
    );
    const historyData = await historyRes.json();
    addLog(`History response status: ${historyRes.status}`);
    addLog(`History result count: ${historyData.result?.length ?? 'NO RESULT FIELD'}`);
    addLog(`History cursor: ${historyData.cursor ?? 'null'}`);

    if (historyData.result?.length > 0) {
      const tx = historyData.result[0];
      addLog(`First tx hash: ${tx.hash}`);
      addLog(`First tx timestamp: ${tx.block_timestamp}`);
      addLog(`First tx summary: ${tx.summary}`);
      addLog(`First tx from: ${tx.from_address}`);
      addLog(`First tx to: ${tx.to_address}`);
      addLog(`First tx value: ${tx.value}`);
      addLog(`First tx erc20_transfers count: ${tx.erc20_transfers?.length ?? 0}`);
      addLog(`First tx native_transfers count: ${tx.native_transfers?.length ?? 0}`);
      addLog(`First tx possible_spam: ${tx.possible_spam}`);
      addLog(`First tx receipt_status: ${tx.receipt_status}`);
      addLog(`First tx gas_price: ${tx.gas_price}`);
      addLog(`First tx transaction_fee: ${tx.transaction_fee}`);

      if (tx.erc20_transfers?.length > 0) {
        const t = tx.erc20_transfers[0];
        addLog(`  ERC20[0]: ${t.token_symbol} from=${t.from_address} to=${t.to_address} value_formatted=${t.value_formatted} possible_spam=${t.possible_spam}`);
      }
      if (tx.native_transfers?.length > 0) {
        const t = tx.native_transfers[0];
        addLog(`  Native[0]: ${t.token_symbol} direction=${t.direction} value_formatted=${t.value_formatted}`);
      }
    }

    // Step 3: Fetch balances
    addLog('--- STEP 3: Fetch balances ---');
    const balRes = await fetch(
      `${MORALIS_BASE}/wallets/${address}/tokens?chain=${chain}&exclude_spam=true`,
      { headers: { 'X-API-Key': apiKey!, accept: 'application/json' } },
    );
    const balData = await balRes.json();
    const tokens = Array.isArray(balData) ? balData : balData.result || [];
    addLog(`Balances response status: ${balRes.status}`);
    addLog(`Balances is array: ${Array.isArray(balData)}`);
    addLog(`Balances has .result: ${!!balData.result}`);
    addLog(`Token count: ${tokens.length}`);
    if (tokens.length > 0) {
      const t = tokens[0];
      addLog(`First token: ${t.symbol} balance_formatted=${t.balance_formatted} usd_price=${t.usd_price} (type: ${typeof t.usd_price})`);
    }

    // Step 4: EUR rates
    addLog('--- STEP 4: EUR rates ---');
    try {
      const eurRes = await fetch('https://api.frankfurter.dev/latest?from=USD&to=EUR');
      const eurData = await eurRes.json();
      addLog(`EUR rate response: ${JSON.stringify(eurData)}`);
    } catch (e) {
      addLog(`EUR rate FAILED: ${e}`);
    }

    // Step 5: Token prices
    addLog('--- STEP 5: Token prices ---');
    if (tokens.length > 0) {
      const testTokens = tokens.slice(0, 3).map((t: any) => ({
        token_address: t.token_address,
        chain,
      }));
      const priceRes = await fetch(`${MORALIS_BASE}/erc20/prices`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ tokens: testTokens }),
      });
      const priceData = await priceRes.json();
      addLog(`Price response status: ${priceRes.status}`);
      addLog(`Price response is array: ${Array.isArray(priceData)}`);
      addLog(`Price count: ${Array.isArray(priceData) ? priceData.length : 'not array'}`);
      if (Array.isArray(priceData) && priceData.length > 0) {
        addLog(`First price: tokenAddress=${priceData[0].tokenAddress} usdPrice=${priceData[0].usdPrice}`);
      }
    }

    // Step 6: Check what our pipeline.ts would do
    addLog('--- STEP 6: Pipeline simulation ---');
    addLog(`getTaxYearRange(2025) from_date: 2025-01-01, to_date: 2025-12-31`);

    // Check receipt_status filter
    if (historyData.result) {
      const passed = historyData.result.filter((tx: any) => tx.receipt_status !== '0');
      addLog(`After receipt_status filter: ${passed.length}/${historyData.result.length}`);

      const noSpam = passed.filter((tx: any) => tx.possible_spam !== 'true');
      addLog(`After spam filter: ${noSpam.length}/${passed.length}`);

      let txCount = 0;
      for (const tx of noSpam) {
        const erc20 = tx.erc20_transfers?.filter((t: any) => t.possible_spam !== 'true') || [];
        const native = tx.native_transfers || [];
        const hasValue = BigInt(tx.value || '0') > BigInt(0);

        if (erc20.length === 0 && native.length === 0 && !hasValue) {
          addLog(`TX ${tx.hash?.slice(0,10)}... SKIPPED: no transfers, no value`);
        } else {
          txCount += erc20.length + native.length + (erc20.length === 0 && native.length === 0 && hasValue ? 1 : 0);
          addLog(`TX ${tx.hash?.slice(0,10)}... OK: ${erc20.length} erc20, ${native.length} native, value=${tx.value}`);
        }
      }
      addLog(`Total transactions that would be created: ${txCount}`);
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    addLog(`FATAL ERROR: ${error}`);
    return NextResponse.json({ success: false, log, error: String(error) });
  }
}
