import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserMessage } from '@/lib/ai/chat';
import type { ChatContext } from '@/lib/ai/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      message,
      context,
      history,
    }: {
      message: string;
      context: ChatContext;
      history: { role: 'user' | 'assistant'; content: string }[];
    } = body;

    if (!message || !context) {
      return new Response(JSON.stringify({ error: 'Missing message or context' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(message, context);

    // Build messages array from history + new message
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history || []).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Convert the SDK stream to a ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
