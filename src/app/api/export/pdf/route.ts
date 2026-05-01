import { NextRequest, NextResponse } from 'next/server';
import { generateTaxReport } from '@/lib/export/pdf-report';
import type { Transaction, TaxSummary } from '@/types';
import type { UserInfo } from '@/lib/export/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactions,
      summary,
      userInfo,
      taxYear,
    }: {
      transactions: Transaction[];
      summary: TaxSummary;
      userInfo: UserInfo;
      taxYear: number;
    } = body;

    if (!transactions || !summary || !userInfo || !taxYear) {
      return NextResponse.json(
        { error: 'Missing required fields: transactions, summary, userInfo, taxYear' },
        { status: 400 },
      );
    }

    const pdfBytes = generateTaxReport(transactions, summary, userInfo, taxYear);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="crypto-tax-report-${taxYear}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 },
    );
  }
}
