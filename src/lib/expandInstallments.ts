import type { Transaction } from "@/components/DataEntryForm";

export interface ExpandedTransaction extends Transaction {
  isVirtual?: boolean;
  originalId?: string;
  installmentMonth?: number;
  installmentYear?: number;
}

/**
 * Expands installment transactions into virtual entries for each month.
 * A 9x installment starting in January will produce entries for Jan-Sep.
 */
export function expandInstallments(transactions: Transaction[]): ExpandedTransaction[] {
  const result: ExpandedTransaction[] = [];

  for (const t of transactions) {
    if (t.installments && t.installments > 1) {
      // Use paymentDate as the base for installment months when available
      const baseDate = t.paymentDate ? new Date(t.paymentDate) : new Date(t.date);
      const startMonth = baseDate.getMonth();
      const startYear = baseDate.getFullYear();
      const purchaseDate = new Date(t.date);

      for (let i = 0; i < t.installments; i++) {
        const installmentDate = new Date(startYear, startMonth + i, baseDate.getDate());
        // Clamp to last day of month if needed
        if (installmentDate.getDate() !== baseDate.getDate()) {
          installmentDate.setDate(0);
        }

        result.push({
          ...t,
          id: i === 0 ? t.id : `${t.id}_inst_${i + 1}`,
          originalId: t.id,
          currentInstallment: i + 1,
          date: purchaseDate.toISOString().split("T")[0],
          paymentDate: installmentDate.toISOString().split("T")[0],
          description: `${t.description} (${i + 1}/${t.installments})`,
          isVirtual: i !== 0,
          installmentMonth: installmentDate.getMonth(),
          installmentYear: installmentDate.getFullYear(),
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
