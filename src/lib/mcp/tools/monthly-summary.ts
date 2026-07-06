import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "monthly_summary",
  title: "Resumo mensal",
  description:
    "Retorna totais de receitas, despesas, saldo e gasto por categoria para um mês (YYYY-MM). Usa a data de pagamento quando presente, caso contrário a data do lançamento.",
  inputSchema: {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("Mês no formato YYYY-MM"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const { data, error } = await supabaseForUser(ctx)
      .from("transactions")
      .select("date,payment_date,type,category,amount,status")
      .eq("user_id", ctx.getUserId());
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const t of data ?? []) {
      const ref = (t.payment_date || t.date) as string;
      if (!ref || ref < start || ref >= nextMonth) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      else if (t.type === "expense") {
        expense += amt;
        byCategory[t.category] = (byCategory[t.category] || 0) + amt;
      }
    }
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({ category, total }));

    const summary = { month, income, expense, balance: income - expense, expense_by_category: topCategories };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
