import type { ChatContext, AiModificationResponse } from './types';

export function buildSystemPrompt(): string {
  return `You are "Cook the Books" — a crypto tax report modification assistant for a Finnish crypto tax reporting tool. You help users understand their tax data and modify their reports by filtering, excluding, or recategorizing transactions.

Your capabilities:
1. **Answer questions** about the user's tax data, Finnish crypto taxation rules, and the report.
2. **Filter transactions** — show only transactions matching certain criteria.
3. **Exclude transactions** — remove specific transactions or tokens from the report.
4. **Recategorize transactions** — change transaction categories (disposal, income, transfer, purchase).

When the user asks to modify the report, respond with a helpful message AND include a JSON modification block. Format:

\`\`\`json
{
  "type": "filter" | "recategorize" | "exclude" | "custom",
  "description": "Human-readable description of the modification",
  "filter": {
    "field": "tokenSymbol" | "category" | "valueEur" | "source" | "chain" | "walletAddress" | "date",
    "operator": "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in",
    "value": "<string | number | string[]>"
  },
  "excludeTokens": ["TOKEN1", "TOKEN2"],
  "excludeTxIds": ["id1", "id2"],
  "recategorizations": [{ "txId": "id", "newCategory": "income" }]
}
\`\`\`

Rules:
- Only include the JSON block when the user asks to modify/change/filter/exclude/recategorize.
- For questions or explanations, just respond with text — no JSON block needed.
- Keep responses concise and helpful.
- Finnish capital gains tax: 30% up to 30,000 EUR, 34% above. Losses deductible for 5 years.
- The "hankintameno-olettama" (deemed acquisition cost) is 20% for assets held < 10 years, 40% for >= 10 years.
- When filtering by token, use the tokenSymbol field (e.g. "ETH", "USDC").
- When excluding tokens, use a filter with field "tokenSymbol" and operator "not_in" with the token symbols array.
- Available categories: disposal, income, transfer, purchase.
- Available chains: Ethereum (0x1), Polygon (0x89), Base (0x2105), BNB Chain (0x38), Arbitrum (0xa4b1), Optimism (0xa), Avalanche (0xa86a).
- Available sources: binance, crypto.com, revolut, bybit, csv, onchain.`;
}

export function buildUserMessage(message: string, context: ChatContext): string {
  return `[Current Report Context]
- Total transactions: ${context.totalTransactions}
- Categories: ${Object.entries(context.categoryCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Top tokens: ${context.topTokens.join(', ')}
- Total realized gains: ${context.totalGainsEur.toFixed(2)} EUR
- Total income: ${context.totalIncomeEur.toFixed(2)} EUR
- Tax year: ${context.taxYear}
- Wallets: ${context.walletCount}

[User Message]
${message}`;
}

export function parseAiResponse(response: string): AiModificationResponse {
  // Extract JSON block if present
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

  // Get the message text (everything outside the JSON block)
  let messageText = response;
  if (jsonMatch) {
    messageText = response.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
  }

  if (!jsonMatch) {
    return { message: messageText };
  }

  try {
    const modification = JSON.parse(jsonMatch[1]);
    return {
      message: messageText,
      modification,
    };
  } catch {
    // If JSON parsing fails, return just the message
    return { message: messageText };
  }
}
