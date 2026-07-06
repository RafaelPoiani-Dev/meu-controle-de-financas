import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign } from "lucide-react";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("authorization_id ausente");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("Nenhum redirect retornado pelo servidor de autorização.");
    }
    window.location.href = target;
  }

  if (error)
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Não foi possível carregar a autorização</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </main>
    );
  if (!details)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </main>
    );

  const clientName = details.client?.name ?? "um aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl gradient-warm flex items-center justify-center">
            <DollarSign className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Conectar {clientName}</h1>
            <p className="text-sm text-muted-foreground">Acesso aos seus dados financeiros</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {clientName} poderá ler e criar lançamentos, categorias e resumos em sua conta enquanto esta
          autorização estiver ativa. Você pode revogar a qualquer momento.
        </p>
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 py-2.5 rounded-lg border border-border font-medium disabled:opacity-50"
          >
            Recusar
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 py-2.5 rounded-lg gradient-warm text-primary-foreground font-semibold disabled:opacity-50"
          >
            Aprovar
          </button>
        </div>
      </div>
    </main>
  );
}
