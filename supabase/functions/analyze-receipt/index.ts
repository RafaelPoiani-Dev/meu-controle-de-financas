import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { imageUrl, existingCategories } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoriesList = Array.isArray(existingCategories) && existingCategories.length
      ? existingCategories.join(", ")
      : "Alimentação, Higiene, Bebidas, Limpeza, Outros";

    const systemPrompt = `Você é um assistente que analisa fotos de cupons fiscais brasileiros.
Retorne SEMPRE via tool call com:
- merchant: nome do estabelecimento
- purchase_date: data da compra em YYYY-MM-DD (se não achar, use string vazia)
- total: valor total do cupom (número em reais)
- items: array de itens { name, quantity, amount, category }
  - amount é o valor TOTAL do item (quantidade * preço unitário)
  - category deve, quando possível, ser uma destas existentes: ${categoriesList}. Se nenhuma se encaixar, crie uma categoria curta e clara em português (ex: "Padaria", "Frutas", "Carnes").
- top_category: a categoria com maior gasto total no cupom.
Nunca invente valores; se ilegível, deixe 0.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise este cupom fiscal e extraia os dados." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_receipt",
            description: "Retorna dados estruturados do cupom fiscal",
            parameters: {
              type: "object",
              properties: {
                merchant: { type: "string" },
                purchase_date: { type: "string" },
                total: { type: "number" },
                top_category: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "number" },
                      amount: { type: "number" },
                      category: { type: "string" },
                    },
                    required: ["name", "amount", "category"],
                  },
                },
              },
              required: ["merchant", "total", "items", "top_category"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_receipt" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
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
      return new Response(JSON.stringify({ error: "Falha na IA", detail: errText }), {
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
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
