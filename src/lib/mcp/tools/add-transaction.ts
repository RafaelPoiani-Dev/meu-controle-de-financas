import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_transaction",
  title: "Adicionar lançamento",
  description:
    "Cria um novo lançamento financeiro (receita ou despesa) para o usuário autenticado.",
  inputSchema: {
    date: z.string().describe("Data do lançamento YYYY-MM-DD"),
    description: z.string().min(1),
    category: z.string().min(1),
    type: z.enum(["income", "expense"]),
    amount: z.number().positive(),
    status: z.enum(["pending", "paid"]).default("pending"),
    payment_date: z.string().optional().describe("Data de pagamento YYYY-MM-DD"),
    credit_card: z.string().optional(),
    installments: z.number().int().min(1).optional(),
    current_installment: z.number().int().min(1).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("transactions")
      .insert({ ...input, user_id: ctx.getUserId() })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Lançamento criado: ${data.id}` }],
      structuredContent: { transaction: data },
    };
  },
});
