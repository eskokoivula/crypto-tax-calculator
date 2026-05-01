import { NextRequest, NextResponse } from 'next/server';
import { generateCsv } from '@/lib/export/csv';
import type { Transaction } from '@/types';
import type { CsvFormat } from '@/lib/export/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactions,
      format,
    }: {
      transactions: Transaction[];
      format: CsvFormat;
    } = body;

    if (!transactions || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: transactions, format' },
        { status: 400 },
      );
    }

    const validFormats: CsvFormat[] = ['generic', 'koinly', 'turbotax', 'omavero'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 },
      );
    }

    const csv = generateCsv(transactions, format);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="crypto-transactions-${format}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSV generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV' },
      { status: 500 },
    );
  }
}
