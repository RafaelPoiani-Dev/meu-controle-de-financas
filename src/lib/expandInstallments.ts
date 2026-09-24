import type { Transaction } from "@/components/DataEntryForm";

export interface ExpandedTransaction extends Transaction {
  isVirtual?: boolean;
  originalId?: string;
  installmentMonth?: number;
  installmentYear?: number;
}

// Adds N months to a YYYY-MM-DD string without any timezone conversion.
function addMonths(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const total = y * 12 + (m - 1) + monthsToAdd;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

// Removes a trailing "(3/8)" suffix so we never duplicate it.
function baseDescription(description: string): string {
  return description.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

/**
 * Expands installment transactions into virtual entries for each remaining month.
 * A purchase stored as installment 3 of 8 produces 3/8 in its own month and 4/8..8/8 ahead.
 */
export function expandInstallments(transactions: Transaction[]): ExpandedTransaction[] {
  const result: ExpandedTransaction[] = [];

  for (const t of transactions) {
    const total = t.installments ?? 0;
    if (total > 1) {
      const base = t.paymentDate || t.date;
      const start = Math.min(Math.max(t.currentInstallment || 1, 1), total);
      const label = baseDescription(t.description);

      for (let n = start; n <= total; n++) {
        const paymentDate = addMonths(base, n - start);
        const [py, pm] = paymentDate.split("-").map(Number);

        result.push({
          ...t,
          id: n === start ? t.id : `${t.id}_inst_${n}`,
          originalId: t.id,
          currentInstallment: n,
          date: t.date,
          paymentDate,
          description: `${label} (${n}/${total})`,
          isVirtual: n !== start,
          installmentMonth: pm - 1,
          installmentYear: py,
        });
      }
    } else {
      result.push({ ...t, originalId: t.id });
    }
  }

  return result;
}


/**
 * Filters expanded transactions by month/year.
 */
/**
 * Filters expanded transactions by month/year.
 * Uses paymentDate when available, otherwise falls back to date.
 */
export function filterByMonthYear(
  expanded: ExpandedTransaction[],
  year: number,
  month: number
): ExpandedTransaction[] {
  return expanded.filter((t) => {
    const effectiveDate = t.paymentDate || t.date;
    const [y, m] = effectiveDate.split("-").map(Number);
    return y === year && m - 1 === month;
  });
}
