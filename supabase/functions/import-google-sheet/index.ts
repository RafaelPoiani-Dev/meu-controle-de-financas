import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SHEET_NAME = "Lançamentos";

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, existingCategories } = await req.json();
    if (typeof url !== "string" || !url.trim()) {
      return new Response(JSON.stringify({ error: "Link da planilha obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const id = extractSpreadsheetId(url);
    if (!id) {
      return new Response(JSON.stringify({ error: "Link inválido. Copie o link completo da planilha do Google Sheets." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const sheetRes = await fetch(csvUrl, { redirect: "follow" });
    const csv = await sheetRes.text();

    if (!sheetRes.ok || csv.trimStart().startsWith("<")) {
      return new Response(
        JSON.stringify({ error: "Não consegui abrir a planilha. Verifique se ela está compartilhada como 'qualquer pessoa com o link pode ver' e se existe a aba Lançamentos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (csv.trim().length < 5) {
      return new Response(JSON.stringify({ error: "A aba Lançamentos está vazia." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoriesList = Array.isArray(existingCategories) && existingCategories.length
      ? existingCategories.join(", ")
      : "Outros";

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Você converte uma planilha CSV de controle financeiro brasileiro em lançamentos estruturados.
Regras:
- Descubra sozinho quais colunas representam data da compra, data de pagamento, descrição, categoria, tipo (receita/despesa), valor, cartão/meio de pagamento, status e parcelas.
- Ignore linhas de cabeçalho, totais, subtotais e linhas vazias.
- Datas SEMPRE no formato YYYY-MM-DD. Converta dd/mm/aaaa corretamente. Se o ano não aparecer, use ${today.slice(0, 4)}.
- payment_date: use a data de pagamento da planilha. Se não houver, deixe string vazia.
- Valores: número positivo em reais (1.234,56 => 1234.56). O tipo define se é receita ou despesa.
- type: "income" para receitas/entradas, "expense" para despesas/saídas.
- category: prefira uma destas existentes: ${categoriesList}. Só crie uma nova categoria curta em português quando nenhuma se encaixar.
- status: "paid" quando a planilha indicar pago/quitado, senão "pending".
- Nunca invente lançamentos que não estão no CSV.
Data de hoje: ${today}.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `CSV da aba ${SHEET_NAME}:\n\n${csv.slice(0, 120000)}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_entries",
            description: "Retorna os lançamentos extraídos da planilha",
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
                    required: ["date", "description", "category", "type", "amount"],
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
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao ler a planilha com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify({ entries: parsed.entries ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-google-sheet error", e);
    return new Response(JSON.stringify({ error: "Erro inesperado ao importar a planilha" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
