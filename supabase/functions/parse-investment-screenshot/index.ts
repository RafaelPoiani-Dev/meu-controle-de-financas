import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) return json({ error: "Envie ao menos um print." }, 400);
    if (images.length > 8) return json({ error: "Envie no máximo 8 prints por vez." }, 400);
    if (images.some((i) => typeof i !== "string" || !i.startsWith("data:image/")))
      return json({ error: "Formato de imagem inválido." }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Serviço de IA indisponível." }, 500);
    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Você lê prints de extratos/movimentações de INVESTIMENTOS de bancos brasileiros (CDB, Tesouro, caixinha, poupança, fundos, reserva).
Para cada movimentação extraia:
- date: data da movimentação em YYYY-MM-DD (converta dd/mm/aaaa; se faltar o ano use ${today.slice(0, 4)}; "hoje" = ${today}).
- description: texto curto da movimentação (ex.: "Aplicação CDB", "Resgate Tesouro").
- kind: "deposit" quando o dinheiro ENTROU no investimento (aplicação, aporte, depósito, guardado); "withdraw" quando SAIU (resgate, saque, retirada).
- amount: valor positivo em reais (1.234,56 => 1234.56).
Ignore saldos, totais, rendimentos projetados e cabeçalhos. Se a mesma movimentação aparecer em dois prints sobrepostos, retorne uma vez só.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Extraia as movimentações destes prints." },
            ...images.map((url: string) => ({ type: "image_url", image_url: { url } })),
          ] },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_moves",
            parameters: {
              type: "object",
              properties: {
                moves: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      description: { type: "string" },
                      kind: { type: "string", enum: ["deposit", "withdraw"] },
                      amount: { type: "number" },
                    },
                    required: ["date", "description", "kind", "amount"],
                  },
                },
              },
              required: ["moves"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_moves" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return json({ error: "Muitas leituras seguidas. Tente novamente em instantes." }, 429);
      if (res.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }, 402);
      console.error("AI gateway error", res.status);
      return json({ error: "Falha ao ler os prints com a IA." }, 500);
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ moves: [] });
    const parsed = JSON.parse(call.function.arguments);
    const moves = (parsed.moves ?? [])
      .map((m: Record<string, unknown>) => ({
        date: String(m.date ?? "").slice(0, 10),
        description: String(m.description ?? "").trim() || "Movimentação",
        kind: m.kind === "withdraw" ? "withdraw" : "deposit",
        amount: Math.abs(Number(m.amount) || 0),
      }))
      .filter((m: { amount: number; date: string }) => m.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.date));
    return json({ moves });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro ao processar os prints." }, 500);
  }
});
