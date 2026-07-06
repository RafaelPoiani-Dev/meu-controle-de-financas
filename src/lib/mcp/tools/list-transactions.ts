import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "Listar lançamentos",
  description:
    "Lista lançamentos financeiros do usuário autenticado, com filtros opcionais por intervalo de datas, tipo, categoria e status.",
  inputSchema: {
    start_date: z.string().optional().describe("Data inicial YYYY-MM-DD (inclusive)"),
    end_date: z.string().optional().describe("Data final YYYY-MM-DD (inclusive)"),
    type: z.enum(["income", "expense"]).optional().describe("Tipo de lançamento"),
    category: z.string().optional().describe("Categoria exata"),
    status: z.enum(["pending", "paid"]).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, type, category, status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("transactions")
      .select("id,date,description,category,type,amount,status,payment_date,credit_card,installments,current_installment")
      .eq("user_id", ctx.getUserId())
      .order("date", { ascending: false })
      .limit(limit);
    if (start_date) q = q.gte("date", start_date);
    if (end_date) q = q.lte("date", end_date);
    if (type) q = q.eq("type", type);
    if (category) q = q.eq("category", category);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
