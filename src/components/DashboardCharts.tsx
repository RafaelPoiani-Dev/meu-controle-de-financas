import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { Transaction } from "./DataEntryForm";

interface DashboardChartsProps {
  transactions: Transaction[];
  spentByCard: Record<string, number>;
}

const CATEGORY_COLORS = [
  "hsl(0, 78%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(45, 100%, 55%)",
  "hsl(145, 65%, 42%)",
  "hsl(200, 70%, 50%)",
  "hsl(270, 60%, 55%)",
  "hsl(320, 65%, 50%)",
  "hsl(180, 55%, 45%)",
  "hsl(60, 70%, 45%)",
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DashboardCharts = ({ transactions, spentByCard }: DashboardChartsProps) => {
  // Charts now receive pre-filtered transactions, so no need for month/year filtering

  // Gastos por categoria (despesas)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Top expenses (already filtered by month/year from parent)
  const topExpenses = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions]);

  // Receita vs Despesa
  const incomeVsExpense = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return [
      { name: "Receitas", value: income },
      { name: "Despesas", value: expense },
    ];
  }, [transactions]);

  // Cartão mais usado
  const cardUsageData = useMemo(() => {
    return Object.entries(spentByCard)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [spentByCard]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-card px-3 py-2 text-sm">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-muted-foreground">{fmt(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Gastos por Categoria - Pie */}
      <div className="bg-card rounded-lg shadow-card border border-border p-5">
        <h3 className="text-sm font-bold font-display text-foreground mb-4">Gastos por Categoria</h3>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem despesas registradas</p>
        )}
      </div>

      {/* Receita vs Despesa */}
      <div className="bg-card rounded-lg shadow-card border border-border p-5">
        <h3 className="text-sm font-bold font-display text-foreground mb-4">Receitas vs Despesas</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={incomeVsExpense} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 88%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              <Cell fill="hsl(145, 65%, 42%)" />
              <Cell fill="hsl(0, 78%, 55%)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Maiores Gastos do Período */}
      <div className="bg-card rounded-lg shadow-card border border-border p-5 lg:col-span-2">
        <h3 className="text-sm font-bold font-display text-foreground mb-4">Maiores Gastos do Período</h3>
        {topExpenses.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topExpenses} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 88%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(25, 90%, 55%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem gastos no período</p>
        )}
      </div>

      {/* Cartão mais usado */}
      <div className="bg-card rounded-lg shadow-card border border-border p-5 lg:col-span-2">
        <h3 className="text-sm font-bold font-display text-foreground mb-4">Uso dos Cartões</h3>
        {cardUsageData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cardUsageData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(200, 70%, 50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma despesa em cartão</p>
        )}
      </div>
    </div>
  );
};

export default DashboardCharts;
