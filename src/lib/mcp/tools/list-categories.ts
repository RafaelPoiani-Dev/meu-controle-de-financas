import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "Listar categorias",
  description: "Lista as categorias configuradas pelo usuário (receitas e despesas).",
  inputSchema: {
    type: z.enum(["income", "expense"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("user_categories")
      .select("id,name,type")
      .eq("user_id", ctx.getUserId())
      .order("name");
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
