'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Transaction, TaxSummary } from '@/types';
import type { CsvFormat, Lomake9Data, UserInfo } from '@/lib/export/types';
import { FileText, Table, FileDown, Loader2, Archive } from 'lucide-react';

interface ExportButtonsProps {
  transactions: Transaction[];
  summary: TaxSummary;
  userInfo: UserInfo;
  taxYear: number;
  disposals: Lomake9Data[];
}

type CsvFormatOption = { value: CsvFormat; label: string };

const CSV_FORMATS: CsvFormatOption[] = [
  { value: 'generic', label: 'Generic (Finnish CSV)' },
  { value: 'koinly', label: 'Koinly' },
  { value: 'turbotax', label: 'TurboTax' },
  { value: 'omavero', label: 'OmaVero' },
];

export function ExportButtons({
  transactions,
  summary,
  userInfo,
  taxYear,
  disposals,
}: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [lomakeLoading, setLomakeLoading] = useState(false);
  const [csvFormat, setCsvFormat] = useState<CsvFormat>('generic');
  const [lomakeSelection, setLomakeSelection] = useState<string>('all');

  const disabled = transactions.length === 0;

  // -----------------------------------------------------------------------
  // PDF Report
  // -----------------------------------------------------------------------
  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, summary, userInfo, taxYear }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      downloadBlob(blob, `crypto-tax-report-${taxYear}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setPdfLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // CSV
  // -----------------------------------------------------------------------
  async function handleDownloadCsv() {
    setCsvLoading(true);
    try {
      const res = await fetch('/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, format: csvFormat }),
      });
      if (!res.ok) throw new Error('CSV generation failed');
      const blob = await res.blob();
      downloadBlob(blob, `crypto-transactions-${csvFormat}.csv`);
    } catch (err) {
      console.error(err);
    } finally {
      setCsvLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Lomake 9
  // -----------------------------------------------------------------------
  async function handleDownloadLomake() {
    setLomakeLoading(true);
    try {
      const isBatch = lomakeSelection === 'all';
      const selected = isBatch
        ? disposals
        : [disposals[parseInt(lomakeSelection, 10)]];

      const res = await fetch('/api/export/lomake9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposals: selected, batch: isBatch }),
      });
      if (!res.ok) throw new Error('Lomake 9 generation failed');
      const blob = await res.blob();
      const ext = isBatch ? 'zip' : 'pdf';
      downloadBlob(blob, `lomake9.${ext}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLomakeLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* PDF Report */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            PDF Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Full tax report with summary and transaction details.
          </p>
          <Button
            className="w-full"
            disabled={disabled || pdfLoading}
            onClick={handleDownloadPdf}
          >
            {pdfLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {pdfLoading ? 'Generating...' : 'Download PDF Report'}
          </Button>
        </CardContent>
      </Card>

      {/* CSV Export */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="size-4" />
            CSV Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={csvFormat}
            onValueChange={(val) => setCsvFormat(val as CsvFormat)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {CSV_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full"
            disabled={disabled || csvLoading}
            onClick={handleDownloadCsv}
          >
            {csvLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {csvLoading ? 'Generating...' : 'Download CSV'}
          </Button>
        </CardContent>
      </Card>

      {/* Lomake 9 */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="size-4" />
            Lomake 9
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {disposals.length} disposal{disposals.length !== 1 ? 's' : ''} available
          </p>
          <Select
            value={lomakeSelection}
            onValueChange={(val) => { if (val != null) setLomakeSelection(val); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select disposal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All disposals (ZIP)
              </SelectItem>
              {disposals.map((d, i) => (
                <SelectItem key={i} value={String(i)}>
                  {d.cryptoNames} &mdash;{' '}
                  {new Date(d.disposalDate).toLocaleDateString('fi-FI')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full"
            disabled={disposals.length === 0 || lomakeLoading}
            onClick={handleDownloadLomake}
          >
            {lomakeLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {lomakeLoading ? 'Generating...' : 'Download Lomake 9'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
