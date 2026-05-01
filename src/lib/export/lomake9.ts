import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { splitEurCents, dateToFinnishFormat } from '@/lib/utils';
import type { Lomake9Data } from './types';

/**
 * Generate a single Lomake 9 PDF for one disposal.
 *
 * The template at /public/lomake9-template.pdf contains AcroForm fields that
 * map to the official Finnish tax form 9 (Luovutusvoittojen ja -tappioiden
 * ilmoittaminen).
 */
export async function generateLomake9(data: Lomake9Data): Promise<Uint8Array> {
  const templateUrl =
    typeof window !== 'undefined'
      ? '/lomake9-template.pdf'
      : `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/lomake9-template.pdf`;

  const templateBytes = await fetch(templateUrl).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // --- Identity fields ---
  form.getTextField('020').setText(data.name);
  form.getTextField('901').setText(data.henkilotunnus);
  form.getTextField('902').setText(data.taxYear.toString());

  // --- Kryptovarat checkbox ---
  try {
    form.getCheckBox('900').check();
  } catch {
    // Some template versions expose it as a generic field
    try {
      const field = form.getField('900');
      // @ts-expect-error – setValue works on checkbox-like fields
      field.setValue?.('Yes');
    } catch {
      // Silently continue if the field doesn't exist
    }
  }

  // --- Asset details ---
  form.getTextField('938;1').setText(data.cryptoNames);
  form.getTextField('908').setText(dateToFinnishFormat(data.disposalDate));
  form.getTextField('909').setText(dateToFinnishFormat(data.acquisitionDate));

  // --- Financial fields (EUR + cents) ---
  fillAmount(form, '921', 's921', data.salePriceEur); // 4.1 Myyntihinta
  fillAmount(form, '922', 's922', data.acquisitionCostEur); // 4.2 Hankintahinta
  fillAmount(form, '925', 's925', data.acquisitionExpensesEur); // 4.5 Hankkimismenot
  fillAmount(form, '928', 's928', data.deemedCostEur); // 4.8 Hankintameno-olettama

  // Gain or loss — fill only the applicable row
  if (data.gainEur > 0) {
    fillAmount(form, '929', 's929', data.gainEur); // 4.9 Luovutusvoitto
  }
  if (data.lossEur > 0) {
    fillAmount(form, '930', 's930', data.lossEur); // 4.10 Luovutustappio
  }

  // --- Signature date ---
  form.getTextField('Paivays').setText(formatTodayFinnish());

  // Flatten so the PDF is non-editable
  form.flatten();

  return pdfDoc.save();
}

/**
 * Generate a ZIP archive containing one Lomake 9 PDF per disposal.
 */
export async function generateBatchLomake9(
  disposals: Lomake9Data[],
): Promise<Uint8Array> {
  const zip = new JSZip();

  for (let i = 0; i < disposals.length; i++) {
    const disposal = disposals[i];
    const pdfBytes = await generateLomake9(disposal);
    const idx = String(i + 1).padStart(3, '0');
    const dateStr = formatIsoDate(disposal.disposalDate);
    const fileName = `lomake9_${idx}_${disposal.cryptoNames.replace(/[, ]+/g, '-')}_${dateStr}.pdf`;
    zip.file(fileName, pdfBytes);
  }

  return zip.generateAsync({ type: 'uint8array' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillAmount(
  form: ReturnType<PDFDocument['getForm']>,
  eurField: string,
  centsField: string,
  amount: number,
) {
  const { eur, cents } = splitEurCents(amount);
  try {
    form.getTextField(eurField).setText(eur);
    form.getTextField(centsField).setText(cents);
  } catch {
    // Field may not exist in every template revision
  }
}

function formatTodayFinnish(): string {
  const d = new Date();
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function formatIsoDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}
