import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_credit_cards",
  title: "Listar cartões",
  description: "Lista os cartões de crédito cadastrados pelo usuário e seus limites.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("user_credit_cards")
      .select("id,name,card_limit")
      .eq("user_id", ctx.getUserId())
      .order("name");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { credit_cards: data ?? [] },
    };
  },
});
