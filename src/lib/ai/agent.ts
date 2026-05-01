/**
 * Autonomous resolution agent.
 *
 * Uses Claude with tool_use (function calling) to resolve missing cost basis
 * entries in the FIFO engine. The agent tries to find acquisition data by
 * searching older wallet history, looking up historical prices, and checking
 * token metadata. It only asks the user when all autonomous options are exhausted.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  handleFetchOlderHistory,
  handleLookupTokenPrice,
  handleSearchTokenInfo,
  handleResolveCostBasis,
  handleAskUser,
} from './agent-tools';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'fetch_older_history',
    description:
      'Fetch wallet transaction history before a given date to find acquisition transactions for missing cost basis. Returns decoded transactions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wallet_address: {
          type: 'string',
          description: 'The wallet address to scan',
        },
        chain: {
          type: 'string',
          description: 'Chain hex ID (e.g., 0x1 for Ethereum)',
        },
        before_date: {
          type: 'string',
          description: 'ISO date string — fetch history before this date',
        },
      },
      required: ['wallet_address', 'chain', 'before_date'],
    },
  },
  {
    name: 'lookup_token_price',
    description:
      'Get the historical price of a token at a specific date. Use this to determine acquisition cost when the original purchase price is unknown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: {
          type: 'string',
          description: 'Token contract address',
        },
        chain: { type: 'string', description: 'Chain hex ID' },
        date: {
          type: 'string',
          description: 'ISO date string for the historical price',
        },
      },
      required: ['token_address', 'chain', 'date'],
    },
  },
  {
    name: 'search_token_info',
    description:
      'Look up token contract details to determine its type (staking reward token, LP token, governance token, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: {
          type: 'string',
          description: 'Token contract address',
        },
        chain: { type: 'string', description: 'Chain hex ID' },
      },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'resolve_cost_basis',
    description:
      'Set the resolved cost basis for a token acquisition. Call this when you have determined the acquisition cost.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_symbol: { type: 'string' },
        amount: { type: 'number' },
        cost_eur_per_unit: { type: 'number' },
        acquisition_date: { type: 'string' },
        source: {
          type: 'string',
          description:
            'How the cost was determined: "historical_price", "older_history", "zero_cost_airdrop"',
        },
      },
      required: [
        'token_symbol',
        'amount',
        'cost_eur_per_unit',
        'acquisition_date',
        'source',
      ],
    },
  },
  {
    name: 'ask_user',
    description:
      'Ask the user a specific, precise question when you cannot resolve the data gap independently. Use this as a LAST RESORT only after trying other tools.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'A specific, clear question for the user',
        },
        context: {
          type: 'string',
          description:
            'Brief context about what you found and why you need their input',
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Possible answers to make it easier for the user',
        },
      },
      required: ['question', 'context'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution router
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case 'fetch_older_history':
        return await handleFetchOlderHistory(
          input as {
            wallet_address: string;
            chain: string;
            before_date: string;
          },
        );
      case 'lookup_token_price':
        return await handleLookupTokenPrice(
          input as {
            token_address: string;
            chain: string;
            date: string;
          },
        );
      case 'search_token_info':
        return await handleSearchTokenInfo(
          input as { token_address: string; chain: string },
        );
      case 'resolve_cost_basis':
        return await handleResolveCostBasis(
          input as {
            token_symbol: string;
            amount: number;
            cost_eur_per_unit: number;
            acquisition_date: string;
            source: string;
          },
        );
      case 'ask_user':
        return await handleAskUser(
          input as {
            question: string;
            context: string;
            suggestions?: string[];
          },
        );
      default:
        return JSON.stringify({
          error: true,
          message: `Unknown tool: ${name}`,
        });
    }
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: `Tool "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AgentResolution {
  resolvedItems: {
    tokenSymbol: string;
    amount: number;
    costEurPerUnit: number;
    acquisitionDate: string;
    source: string;
  }[];
  userQuestions: {
    question: string;
    context: string;
    suggestions?: string[];
  }[];
  summary: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an autonomous tax data resolution agent for a Finnish crypto tax reporting application.

Your job is to find missing acquisition costs (cost basis) for crypto tokens so that the FIFO (First In, First Out) engine can correctly calculate capital gains.

## Context
- The user is Finnish. All monetary values should be in EUR.
- Finnish tax law requires FIFO cost basis for crypto asset disposals.
- Capital gains tax: 30% up to 30,000 EUR, 34% above that.
- The "hankintameno-olettama" (deemed acquisition cost) of 20% (< 10 years) or 40% (>= 10 years) can be used if more favorable, but we still need the actual cost basis for comparison.

## Your resolution strategy (follow this order):
1. **fetch_older_history** — Search the wallet's older transaction history for the original acquisition (purchase, swap, or incoming transfer).
2. **lookup_token_price** — If the acquisition transaction is found but has no price data, look up the token price at that date.
3. **search_token_info** — Check token metadata to understand if it's an airdrop, staking reward, LP token, etc. This helps determine the correct cost basis approach.
4. **resolve_cost_basis** — Once you've determined the cost basis, call this to record it.
5. **ask_user** — LAST RESORT. Only ask the user if you cannot determine the cost basis through the other tools. Ask specific, actionable questions with suggested answers.

## Cost basis rules for special cases:
- **Airdrops**: Cost basis is 0 EUR (zero cost). The fair market value at receipt is taxable income.
- **Staking rewards**: Fair market value at the time of receipt is the cost basis, and it's also taxable income.
- **LP tokens**: Cost basis is the value of the assets deposited to create the LP position.
- **Gifts received**: Cost basis is the donor's original acquisition cost (if known), otherwise 0.
- **Mining rewards**: Fair market value at receipt.

## Important:
- Try ALL available wallets and chains when searching for older history.
- Be efficient — don't make redundant tool calls.
- Always call resolve_cost_basis for each item you can resolve.
- Provide a clear summary of what you resolved and what remains unresolved.`;

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 10;

export async function runResolutionAgent(
  missingCostBasis: {
    token: string;
    amount: number;
    earliestDate: Date;
    tokenAddress?: string;
    chain?: string;
  }[],
  walletAddresses: string[],
  chains: string[],
): Promise<AgentResolution> {
  const client = new Anthropic();

  // Build the user message describing all missing items
  const itemDescriptions = missingCostBasis
    .map(
      (item, i) =>
        `${i + 1}. **${item.token}**: ${item.amount} units, earliest disposal date: ${item.earliestDate.toISOString().split('T')[0]}${item.tokenAddress ? `, contract: ${item.tokenAddress}` : ''}${item.chain ? `, chain: ${item.chain}` : ''}`,
    )
    .join('\n');

  const userMessage = `I need you to resolve missing cost basis for the following tokens:

${itemDescriptions}

Available wallets: ${walletAddresses.join(', ')}
Available chains: ${chains.join(', ')}

Please investigate each item and resolve the cost basis. Try to handle as many as possible autonomously.`;

  // Conversation messages
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  // Collect results
  const resolvedItems: AgentResolution['resolvedItems'] = [];
  const userQuestions: AgentResolution['userQuestions'] = [];
  let summary = '';

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    // Check if the model wants to use tools
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & { type: 'tool_use' } =>
        block.type === 'tool_use',
    );

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    // If no tool calls, the agent is done
    if (toolUseBlocks.length === 0) {
      summary = textBlocks.map((b) => b.text).join('\n');
      break;
    }

    // Add the assistant's response to conversation
    messages.push({ role: 'assistant', content: response.content });

    // Execute each tool call and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );

      // Collect resolved items and user questions from tool results
      try {
        const parsed = JSON.parse(result);

        if (toolUse.name === 'resolve_cost_basis' && parsed.resolved) {
          resolvedItems.push({
            tokenSymbol: parsed.tokenSymbol,
            amount: parsed.amount,
            costEurPerUnit: parsed.costEurPerUnit,
            acquisitionDate: parsed.acquisitionDate,
            source: parsed.source,
          });
        }

        if (toolUse.name === 'ask_user' && parsed.queued) {
          const input = toolUse.input as {
            question: string;
            context: string;
            suggestions?: string[];
          };
          userQuestions.push({
            question: input.question,
            context: input.context,
            suggestions: input.suggestions,
          });
        }
      } catch {
        // JSON parse failure is fine — the raw string still goes back to the model
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Feed tool results back to the model
    messages.push({ role: 'user', content: toolResults });

    // If the model indicated it's done (end_turn), break
    if (response.stop_reason === 'end_turn') {
      summary = textBlocks.map((b) => b.text).join('\n');
      break;
    }
  }

  // If we never got a text summary, create one
  if (!summary) {
    const resolvedCount = resolvedItems.length;
    const questionCount = userQuestions.length;
    const totalMissing = missingCostBasis.length;
    summary = `Agent completed after ${MAX_ITERATIONS} iterations. Resolved ${resolvedCount}/${totalMissing} items. ${questionCount} questions for the user.`;
  }

  return {
    resolvedItems,
    userQuestions,
    summary,
  };
}
