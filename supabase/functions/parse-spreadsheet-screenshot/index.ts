import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { images, existingCategories, creditCards } = await req.json();

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Envie ao menos um print da planilha." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (images.length > 8) {
      return new Response(JSON.stringify({ error: "Envie no máximo 8 prints por vez." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const img of images) {
      if (typeof img !== "string" || !img.startsWith("data:image/")) {
        return new Response(JSON.stringify({ error: "Formato de imagem inválido." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Serviço de IA indisponível." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const categoriesList = Array.isArray(existingCategories) && existingCategories.length
      ? existingCategories.join(", ")
      : "Outros";
    const cardsList = Array.isArray(creditCards) && creditCards.length
      ? creditCards.join(", ")
      : "nenhum cartão cadastrado";

    const systemPrompt = `Você lê prints (capturas de tela) de uma planilha de controle financeiro brasileiro e extrai cada linha como um lançamento.

Regras obrigatórias:
- Leia TODAS as linhas visíveis de dados. Ignore cabeçalhos, totais, subtotais, médias e linhas vazias.
- Se a mesma linha aparecer em mais de um print (imagens sobrepostas), retorne-a UMA única vez.
- Datas SEMPRE no formato YYYY-MM-DD. Converta dd/mm/aaaa corretamente. Se o ano não aparecer, use ${today.slice(0, 4)}.
- "date" = data da COMPRA. "payment_date" = data do PAGAMENTO / vencimento / fatura / mês de competência.
- MUITO IMPORTANTE: se a planilha tiver apenas UMA data por linha e ela representar fatura, vencimento, pagamento ou mês de competência, coloque esse valor em "payment_date" E também em "date".
- Se houver data de compra mas não houver data de pagamento, repita a data de compra em "payment_date".
- A compra pode ser de um mês anterior ao pagamento: respeite exatamente o que está escrito, nunca mude o mês.
- Se aparecer só "mês/ano" para o pagamento (ex.: 09/2025), use o dia 01 (2025-09-01), a menos que exista um dia de vencimento visível.
- amount: número positivo em reais (1.234,56 => 1234.56).
- type: "income" para receitas/entradas/salário, "expense" para gastos/saídas/despesas.
- category: prefira uma destas categorias já existentes: ${categoriesList}. Só crie uma nova se realmente nenhuma servir.
- credit_card: use um destes quando a linha indicar cartão: ${cardsList}. Caso contrário deixe vazio.
- status: se o print indicar pago/quitado/ok use "paid"; se indicar pendente/em aberto use "pending". Se não houver indicação, use "paid" quando payment_date for hoje (${today}) ou anterior, e "pending" quando for futura.
- installments/current_installment: preencha só quando o print mostrar parcelas (ex.: 3/12 => installments 12, current_installment 3).`;

    const content: unknown[] = [
      { type: "text", text: "Extraia todos os lançamentos destes prints da planilha." },
      ...images.map((url: string) => ({ type: "image_url", image_url: { url } })),
    ];

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_entries",
            description: "Retorna os lançamentos extraídos dos prints",
            parameters: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      payment_date: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string" },
                      type: { type: "string", enum: ["income", "expense"] },
                      amount: { type: "number" },
                      credit_card: { type: "string" },
                      status: { type: "string", enum: ["pending", "paid"] },
                      installments: { type: "number" },
                      current_installment: { type: "number" },
                    },
                    required: ["date", "payment_date", "description", "category", "type", "amount"],
                  },
                },
              },
              required: ["entries"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_entries" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas leituras seguidas. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error", res.status);
      return new Response(JSON.stringify({ error: "Falha ao ler os prints com a IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "Não consegui identificar lançamentos nos prints." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(call.function.arguments);
    const entries = (parsed.entries ?? []).map((e: Record<string, unknown>) => {
      const date = String(e.date ?? "");
      const paymentDate = String(e.payment_date ?? "") || date;
      return { ...e, date: date || paymentDate, payment_date: paymentDate };
    });

    return new Response(JSON.stringify({ entries }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-spreadsheet-screenshot error", e);
    return new Response(JSON.stringify({ error: "Erro inesperado ao ler os prints." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
