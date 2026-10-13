import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, PieChart as PieIcon, BarChart3, CreditCard, ChevronRight } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, Tooltip,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Transaction } from "./DataEntryForm";

const COLORS = [
  "hsl(0, 78%, 58%)", "hsl(25, 90%, 56%)", "hsl(45, 100%, 55%)", "hsl(145, 55%, 48%)",
  "hsl(195, 70%, 52%)", "hsl(270, 50%, 65%)", "hsl(320, 60%, 58%)", "hsl(175, 55%, 45%)",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

interface Props {
  transactions: Transaction[];
  income: number;
  expense: number;
  balance: number;
  year: number;
  month: number; // 0-based
  cards: { card: string; spent: number }[];
  onOpenCards: () => void;
  overview?: { label: string; value: number; hint?: string }[];
}

const HomeDashboard = ({ transactions, income, expense, balance, year, month, cards, onOpenCards, overview }: Props) => {
  const [view, setView] = useState<"pie" | "bar">("pie");
  const [selected, setSelected] = useState<string | null>(null);

  const expenses = useMemo(() => transactions.filter((t) => t.type === "expense"), [transactions]);

  const daily = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      const d = (t.paymentDate || t.date).slice(8, 10);
      map[d] = (map[d] ?? 0) + t.amount;
    });
    return Array.from({ length: days }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return { day: `${d}/${String(month + 1).padStart(2, "0")}`, value: map[d] ?? 0 };
    });
  }, [expenses, year, month]);

  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((t) => (map[t.category] = (map[t.category] ?? 0) + t.amount));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const totalExp = categories.reduce((s, c) => s + c.value, 0);
  const selectedTx = useMemo(
    () => expenses.filter((t) => t.category === selected).sort((a, b) => (b.paymentDate || b.date).localeCompare(a.paymentDate || a.date)),
    [expenses, selected],
  );
  const cardsTotal = cards.reduce((s, c) => s + c.spent, 0);

  return (
    <div className="space-y-5">
      {/* Topo: saldo + entrada/saída + tendência */}
      <section className="rounded-3xl bg-card border border-border shadow-card p-5 overflow-hidden">
        <div className="grid grid-cols-3 items-end gap-2 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="rounded-full bg-income/15 text-income p-0.5"><ArrowDown size={12} /></span>Entrada
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground whitespace-nowrap">{fmt(income)}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">Saldo</span>
            <span className={`text-xl sm:text-3xl font-bold tracking-tight whitespace-nowrap ${balance >= 0 ? "text-foreground" : "text-expense"}`}>{fmt(balance)}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="rounded-full bg-expense/15 text-expense p-0.5"><ArrowUp size={12} /></span>Saída
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground whitespace-nowrap">{fmt(expense)}</span>
          </div>
        </div>
      </section>

      {overview && overview.length > 0 && (
        <section className="rounded-3xl bg-card border border-border shadow-card p-5">
          <h3 className="text-base font-bold text-foreground mb-3">Visão geral</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.map((o) => (
              <div key={o.label} className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{o.label}</p>
                <p className={`text-base sm:text-lg font-bold truncate ${o.value < 0 ? "text-expense" : "text-foreground"}`}>{fmt(o.value)}</p>
                {o.hint && <p className="text-[11px] text-muted-foreground truncate">{o.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Despesas por categoria */}
      <section className="rounded-3xl bg-card border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Despesas por categoria</h3>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button onClick={() => setView("pie")} className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${view === "pie" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground"}`}><PieIcon size={13} />Pizza</button>
            <button onClick={() => setView("bar")} className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${view === "bar" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground"}`}><BarChart3 size={13} />Barras</button>
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sem despesas neste mês</p>
        ) : (
          <>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                {view === "pie" ? (
                  <PieChart>
                    <Pie data={categories} dataKey="value" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
                      onClick={(d: any) => setSelected(d?.name)}>
                      {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer" />)}
                    </Pie>
                  </PieChart>
                ) : (
                  <BarChart data={categories.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} onClick={(d: any) => setSelected(d?.name)} className="cursor-pointer">
                      {categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
              {view === "pie" && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{fmt(totalExp)}</span>
                </div>
              )}
            </div>
            <ul className="mt-3 divide-y divide-border">
              {categories.map((c, i) => (
                <li key={c.name}>
                  <button onClick={() => setSelected(c.name)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/50 rounded-lg px-1 transition">
                    <span className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{totalExp ? Math.round((c.value / totalExp) * 100) : 0}% do total</span>
                    </span>
                    <span className="text-sm font-semibold text-foreground">{fmt(c.value)}</span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Contas & cartões */}
      {cards.length > 0 && (
        <section className="rounded-3xl bg-card border border-border shadow-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-foreground">Contas & Cartões</h3>
            <button onClick={onOpenCards} className="text-xs text-primary font-semibold">Ver detalhes</button>
          </div>
          <ul className="divide-y divide-border">
            {cards.map((c) => (
              <li key={c.card} className="flex items-center gap-3 py-2.5">
                <span className="h-9 w-9 rounded-full gradient-warm flex items-center justify-center text-primary-foreground shrink-0"><CreditCard size={16} /></span>
                <span className="flex-1 text-sm font-medium text-foreground truncate">{c.card}</span>
                <span className={`text-sm font-semibold ${c.spent > 0 ? "text-expense" : "text-muted-foreground"}`}>{c.spent > 0 ? `-${fmt(c.spent)}` : fmt(0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-sm font-bold text-expense">{cardsTotal > 0 ? `-${fmt(cardsTotal)}` : fmt(0)}</span>
          </div>
        </section>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected} · {fmt(selectedTx.reduce((s, t) => s + t.amount, 0))}</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {selectedTx.map((t, i) => (
              <li key={`${t.id}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{ddmm(t.paymentDate || t.date)}{t.creditCard ? ` · ${t.creditCard}` : ""}</p>
                </div>
                <span className="text-sm font-semibold text-expense whitespace-nowrap">{fmt(t.amount)}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeDashboard;
