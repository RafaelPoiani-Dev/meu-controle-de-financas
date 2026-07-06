import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactionsTool from "./tools/list-transactions";
import addTransactionTool from "./tools/add-transaction";
import listCategoriesTool from "./tools/list-categories";
import monthlySummaryTool from "./tools/monthly-summary";
import listCreditCardsTool from "./tools/list-credit-cards";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "controle-financeiro-mcp",
  title: "Controle Financeiro",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultar e gerenciar lançamentos financeiros pessoais do usuário. Use `list_transactions` e `monthly_summary` para ler dados, `add_transaction` para criar novos lançamentos, e `list_categories` / `list_credit_cards` para descobrir valores válidos antes de criar lançamentos.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTransactionsTool,
    addTransactionTool,
    listCategoriesTool,
    monthlySummaryTool,
    listCreditCardsTool,
  ],
});
