import { DollarSign } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const nextParam = params.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + (safeNext ?? ""),
    });
    if (error) {
      console.error("Login error:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-warm shadow-warm mb-4">
            <DollarSign size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">Controle Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas finanças com estilo</p>
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 border border-border">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-foreground text-background font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9s0 1.452.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loading ? "Entrando..." : "Entrar com Google"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
