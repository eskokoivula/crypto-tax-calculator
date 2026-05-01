import { NextRequest, NextResponse } from 'next/server';
import { generateLomake9, generateBatchLomake9 } from '@/lib/export/lomake9';
import type { Lomake9Data } from '@/lib/export/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      disposals,
      batch,
    }: {
      disposals: Lomake9Data[];
      batch: boolean;
    } = body;

    if (!disposals || disposals.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: disposals (non-empty array)' },
        { status: 400 },
      );
    }

    // Rehydrate Date objects from JSON strings
    const hydrated = disposals.map((d) => ({
      ...d,
      disposalDate: new Date(d.disposalDate),
      acquisitionDate: new Date(d.acquisitionDate),
    }));

    if (!batch && hydrated.length === 1) {
      // Single Lomake 9 PDF
      const pdfBytes = await generateLomake9(hydrated[0]);

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="lomake9.pdf"`,
        },
      });
    }

    // Batch — return ZIP
    const zipBytes = await generateBatchLomake9(hydrated);

    return new NextResponse(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="lomake9-all.zip"`,
      },
    });
  } catch (error) {
    console.error('Lomake 9 generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate Lomake 9' },
      { status: 500 },
    );
  }
}
