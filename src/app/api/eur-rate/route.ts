import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ rate: 0.87, date: new Date().toISOString().slice(0, 10), source: 'fallback' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: 'What is today\'s USD to EUR exchange rate from the ECB? Reply with ONLY a JSON object: {"rate": 0.9123, "date": "2026-03-31"}',
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return NextResponse.json({ rate: 0.87, date: new Date().toISOString().slice(0, 10), source: 'fallback' });
    }

    const data = await response.json();

    // Extract the text response from Claude
    let rateText = '';
    for (const block of data.content || []) {
      if (block.type === 'text') {
        rateText += block.text;
      }
    }

    // Parse JSON from the response
    const jsonMatch = rateText.match(/\{[^}]*"rate"\s*:\s*([\d.]+)[^}]*"date"\s*:\s*"([^"]+)"[^}]*\}/);
    if (jsonMatch) {
      const rate = parseFloat(jsonMatch[1]);
      const date = jsonMatch[2];
      if (rate > 0 && rate < 2) {
        return NextResponse.json({ rate, date, source: 'claude-web-search' });
      }
    }

    // Try simpler extraction
    const simpleMatch = rateText.match(/(0\.\d{2,6})/);
    if (simpleMatch) {
      const rate = parseFloat(simpleMatch[1]);
      if (rate > 0.5 && rate < 1.5) {
        return NextResponse.json({ rate, date: new Date().toISOString().slice(0, 10), source: 'claude-web-search' });
      }
    }

    return NextResponse.json({ rate: 0.87, date: new Date().toISOString().slice(0, 10), source: 'fallback' });
  } catch (error) {
    console.error('EUR rate fetch failed:', error);
    return NextResponse.json({ rate: 0.87, date: new Date().toISOString().slice(0, 10), source: 'fallback' });
  }
}
