/**
 * Moralis API response types.
 * Field names match the exact snake_case / camelCase as returned by the API.
 */

// ---------- Active Chains ----------

export interface MoralisActiveChain {
  chain: string;
  chain_id: string;
}

export interface MoralisActiveChainsResponse {
  address: string;
  active_chains: MoralisActiveChain[];
}

// ---------- Wallet History ----------

export interface MoralisHistoryErc20Transfer {
  token_name: string;
  token_symbol: string;
  token_logo: string | null;
  token_decimals: string;
  address: string;
  block_timestamp: string;
  to_address_entity: string | null;
  to_address_entity_logo: string | null;
  to_address: string;
  to_address_label: string | null;
  from_address_entity: string | null;
  from_address_entity_logo: string | null;
  from_address: string;
  from_address_label: string | null;
  value: string | number;
  value_formatted: string;
  log_index: number;
  possible_spam: string | boolean;
  verified_contract: string;
}

export interface MoralisHistoryNativeTransfer {
  from_address_entity: string | null;
  from_address_entity_logo: string | null;
  from_address: string;
  from_address_label: string | null;
  to_address_entity: string | null;
  to_address_entity_logo: string | null;
  to_address: string;
  to_address_label: string | null;
  value: string;
  value_formatted: string;
  direction: string;
  internal_transaction: string;
  token_symbol: string;
  token_logo: string | null;
}

export interface MoralisHistoryNftTransfer {
  token_address: string;
  token_id: string;
  token_name: string;
  token_symbol: string;
  from_address_entity: string | null;
  from_address_entity_logo: string | null;
  from_address: string;
  from_address_label: string | null;
  to_address_entity: string | null;
  to_address_entity_logo: string | null;
  to_address: string;
  to_address_label: string | null;
  value: string;
  amount: string;
  contract_type: string;
  transaction_type: string;
  log_index: number;
  operator: string | null;
  possible_spam: string | boolean;
  verified_collection: string;
  direction: string;
  collection_logo: string | null;
  collection_banner_image: string | null;
}

export interface MoralisHistoryInternalTransaction {
  transaction_hash: string;
  block_number: number;
  block_hash: string;
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gas_used: string;
  input: string;
  output: string;
  error: string | null;
}

export interface MoralisHistoryTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address_entity: string | null;
  from_address_entity_logo: string | null;
  from_address: string;
  from_address_label: string | null;
  to_address_entity: string | null;
  to_address_entity_logo: string | null;
  to_address: string;
  to_address_label: string | null;
  value: string;
  gas: string;
  gas_price: string;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address: string | null;
  receipt_status: string;
  transaction_fee: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  internal_transactions: MoralisHistoryInternalTransaction[];
  category: string;
  contract_interactions: unknown[];
  possible_spam: string | boolean;
  method_label: string | null;
  summary: string;
  nft_transfers: MoralisHistoryNftTransfer[];
  erc20_transfers: MoralisHistoryErc20Transfer[];
  native_transfers: MoralisHistoryNativeTransfer[];
}

export interface MoralisHistoryResponse {
  page: string;
  page_size: string;
  cursor: string | null;
  result: MoralisHistoryTransaction[];
}

// ---------- Profitability ----------

export interface MoralisProfitabilityToken {
  token_address: string;
  avg_buy_price_usd: string;
  avg_sell_price_usd: string;
  total_usd_invested: string;
  total_tokens_sold: string;
  total_tokens_bought: string;
  total_sold_usd: string;
  avg_cost_of_quantity_sold: string;
  count_of_trades: number;
  realized_profit_usd: string;
  realized_profit_percentage: number;
  total_buys: number;
  total_sells: number;
  name: string;
  symbol: string;
  decimals: string;
  logo: string | null;
  possible_spam: boolean;
}

export interface MoralisProfitabilityResponse {
  result: MoralisProfitabilityToken[];
}

// ---------- Token Balances with Prices ----------

export interface MoralisTokenBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo: string | null;
  thumbnail: string | null;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  usd_price: string | null;
  usd_price_24hr_percent_change: string | null;
  usd_price_24hr_usd_change: string | null;
  usd_value_24hr_usd_change: string | null;
  usd_value: number | null;
  portfolio_percentage: number;
  balance_formatted: string;
  native_token: boolean;
  total_supply: string | null;
  total_supply_formatted: string | null;
  percentage_relative_to_total_supply: number | null;
}

export interface MoralisTokenBalancesResponse {
  page: string;
  page_size: string;
  block_number: string;
  cursor: string | null;
  result: MoralisTokenBalance[];
}

// ---------- Token Price (single & multiple) ----------
// Note: Token price endpoints return camelCase fields (Moralis inconsistency).

export interface MoralisTokenPrice {
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string | null;
  tokenDecimals: string;
  usdPrice: number;
  usdPriceFormatted: string;
  '24hrPercentChange': string;
  exchangeAddress: string;
  exchangeName: string;
  tokenAddress: string;
  toBlock: string | null;
  possibleSpam: string;
  verifiedContract: boolean;
  pairAddress: string;
  pairTotalLiquidityUsd: string;
  usdPrice24h: number;
  usdPrice24hrUsdChange: number;
  usdPrice24hrPercentChange: number;
  securityScore: number;
}

// ---------- Net Worth ----------

export interface MoralisNetWorthChain {
  chain: string;
  native_balance: string;
  native_balance_formatted: string;
  native_balance_usd: string;
  token_balance_usd: string;
  networth_usd: string;
}

export interface MoralisNetWorthUnavailableChain {
  chain_id: string;
}

export interface MoralisNetWorthResponse {
  total_networth_usd: string;
  chains: MoralisNetWorthChain[];
  unsupported_chain_ids: string[];
  unavailable_chains: MoralisNetWorthUnavailableChain[];
}

// ---------- ERC20 Token Transfers ----------

export interface MoralisTokenTransfer {
  token_name: string;
  token_symbol: string;
  token_logo: string | null;
  token_decimals: string;
  transaction_hash: string;
  address: string;
  block_timestamp: string;
  block_number: number;
  block_hash: string;
  to_address_entity: string | null;
  to_address_entity_logo: string | null;
  to_address: string;
  to_address_label: string | null;
  from_address_entity: string | null;
  from_address_entity_logo: string | null;
  from_address: string;
  from_address_label: string | null;
  value: string | number;
  transaction_index: number;
  log_index: number;
  possible_spam: string | boolean;
  verified_contract: string;
}

export interface MoralisTokenTransfersResponse {
  page: string;
  page_size: string;
  cursor: string | null;
  result: MoralisTokenTransfer[];
}
