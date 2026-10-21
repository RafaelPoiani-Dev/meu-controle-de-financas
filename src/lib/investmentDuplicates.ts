export interface InvestmentMove {
  date: string; // YYYY-MM-DD
  description: string;
  kind: "deposit" | "withdraw";
  amount: number;
}

interface TxLike { date: string; paymentDate?: string; category: string; type: string; amount: number }

const kindOf = (t: TxLike): InvestmentMove["kind"] => (t.type === "income" ? "withdraw" : "deposit");

/**
 * A move is a duplicate when the goal category already has an entry with the
 * same date, same direction and same value (to the cent). Also flags repeats
 * inside the same batch of prints.
 */
export function findDuplicates(moves: InvestmentMove[], txs: TxLike[], category: string) {
  const cat = category.toLowerCase();
  const key = (d: string, k: string, a: number) => `${d}|${k}|${a.toFixed(2)}`;
  const existing = new Set(
    txs.filter((t) => t.category?.toLowerCase() === cat)
      .map((t) => key(t.paymentDate || t.date, kindOf(t), Number(t.amount))),
  );
  const seen = new Set<string>();
  return moves.map((m) => {
    const k = key(m.date, m.kind, Number(m.amount));
    if (existing.has(k)) return "app" as const;
    if (seen.has(k)) return "batch" as const;
    seen.add(k);
    return null;
  });
}
