import { useEffect, useMemo, useState } from "react";
import { Shield, HeartPulse, Sofa, Sparkles, CalendarCheck } from "lucide-react";
import type { Transaction } from "./DataEntryForm";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad = (n: number) => String(n).padStart(2, "0");
const isReserve = (t: Transaction) => /invest|reserva/i.test(t.category || "") || /invest|reserv/i.test(t.type || "");
const isIfood = (t: Transaction) => /ifood/i.test((t.category || "") + (t.creditCard || ""));
const VITAL = /aluguel|moradia|casa|condom|água|agua|luz|energia|internet|g[aá]s|mercado|supermerc|farm[aá]cia|sa[uú]de|plano|escola|educa|transporte|combust|seguro|financ|iptu|telefone|celular/i;

/** Add days to a YYYY-MM-DD string using UTC math (no local timezone shift). */
function addDays(today: string, days: number) {
  const [y, m, d] = today.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + Math.floor(days) * 86400000;
  const r = new Date(ms);
  return `${pad(r.getUTCDate())}/${pad(r.getUTCMonth() + 1)}/${r.getUTCFullYear()}`;
}

function useCount(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

interface Props {
  transactions: Transaction[]; // expanded (installments projected)
  userId?: string;
  monthlyGoal: number;
}

const ZONES = [
  { max: 1, label: "Vulnerável", emoji: "🔴", cls: "bg-destructive" },
  { max: 3, label: "Em construção", emoji: "🟠", cls: "bg-primary" },
  { max: 6, label: "Estável", emoji: "🟡", cls: "bg-accent" },
  { max: Infinity, label: "Blindado", emoji: "🟢", cls: "bg-success" },
];

const CostOfLivingTab = ({ transactions, userId, monthlyGoal }: Props) => {
  const key = `col-class-${userId ?? "anon"}`;
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(overrides)); }, [key, overrides]);
  const [mode, setMode] = useState<"essential" | "current">("essential");

  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // last 3 complete months as YYYY-MM
  const months = useMemo(() => {
    const out: string[] = [];
    let y = now.getFullYear(), m = now.getMonth() + 1;
    for (let i = 0; i < 3; i++) { m--; if (m === 0) { m = 12; y--; } out.push(`${y}-${pad(m)}`); }
    return out;
  }, [today]);

  const data = useMemo(() => {
    const ym = (t: Transaction) => (t.paymentDate || t.date).slice(0, 7);
    const inWindow = transactions.filter((t) => months.includes(ym(t)) && !isIfood(t));
    const byCat: Record<string, number> = {};
    let income = 0;
    for (const t of inWindow) {
      if (t.type === "income" && !isReserve(t)) income += t.amount;
      else if (t.type === "expense" && !isReserve(t)) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
    const cats = Object.entries(byCat)
      .map(([name, total]) => ({ name, avg: total / 3, essential: overrides[name] ?? VITAL.test(name) }))
      .sort((a, b) => b.avg - a.avg);
    // reserve: all history up to today
    let reserve = 0;
    for (const t of transactions) {
      if (!isReserve(t) || (t.paymentDate || t.date) > today) continue;
      reserve += t.type === "income" ? -t.amount : t.amount;
    }
    return { cats, income: income / 3, reserve: Math.max(0, reserve) };
  }, [transactions, months, overrides, today]);

  const floor = data.cats.filter((c) => c.essential).reduce((s, c) => s + c.avg, 0);
  const comfort = data.cats.reduce((s, c) => s + c.avg, 0);
  const ideal = comfort + monthlyGoal;
  const burn = mode === "essential" ? floor : comfort;
  const days = burn > 0 ? data.reserve / (burn / 30) : 0;
  const monthsF = days / 30;
  const zone = ZONES.find((z) => monthsF < z.max)!;
  const animDays = useCount(days);
  const margin = data.income - floor;
  const cut = comfort - floor;

  return (
    <div className="space-y-5">
      {/* Liberdade */}
      <div className="rounded-2xl gradient-warm p-6 text-primary-foreground shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><Shield size={20} /> Dias de Liberdade</div>
          <div className="flex rounded-full bg-background/20 p-1 text-xs">
            {(["essential", "current"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 transition ${mode === m ? "bg-background text-foreground" : ""}`}>
                {m === "essential" ? "Sobrevivência" : "Estilo atual"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 text-5xl font-bold tabular-nums">{Math.floor(animDays)} <span className="text-2xl font-medium">dias</span></div>
        <div className="mt-1 opacity-90">≈ {Math.floor(monthsF)} meses e {Math.floor(days % 30)} dias</div>
        {burn > 0 && data.reserve > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-sm"><CalendarCheck size={16} />
            Suas contas estariam pagas até <b>{addDays(today, days)}</b> sem precisar de renda nova.
          </div>
        ) : (
          <div className="mt-3 text-sm opacity-90">Lance aportes em Investimentos ou Reserva e despesas dos últimos meses para calcular.</div>
        )}
        <div className="mt-4 text-sm">Reserva acumulada: <b>{fmt(data.reserve)}</b> · Custo diário: <b>{fmt(burn / 30)}</b></div>
      </div>

      {/* Zonas */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-2 text-sm font-medium">Nível de segurança: {zone.emoji} {zone.label}</div>
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full gradient-warm transition-all duration-1000" style={{ width: `${Math.min(100, (monthsF / 12) * 100)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>0</span><span>1 mês</span><span>3</span><span>6</span><span>12+ meses</span>
        </div>
      </div>

      {/* Níveis */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: <HeartPulse size={18} />, title: "Piso de Sobrevivência", v: floor, sub: `${fmt(floor / 30)} por dia · só o essencial` },
          { icon: <Sofa size={18} />, title: "Custo Confortável", v: comfort, sub: "Seu padrão real (média de 3 meses)" },
          { icon: <Sparkles size={18} />, title: "Custo Ideal", v: ideal, sub: monthlyGoal > 0 ? `Inclui ${fmt(monthlyGoal)}/mês para a meta principal` : "Crie uma meta para incluir aportes" },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">{c.icon}{c.title}</div>
            <div className="mt-1 text-2xl font-bold">{fmt(c.v)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Diagnóstico */}
      <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm">
        <div className="font-semibold">Diagnóstico</div>
        <p>O mínimo que você precisa ganhar para sobreviver é <b>{fmt(floor)}</b> por mês.</p>
        <p>Sua renda média é <b>{fmt(data.income)}</b> — margem de segurança de{" "}
          <b className={margin >= 0 ? "text-success" : "text-destructive"}>{fmt(margin)}</b> acima do piso.</p>
        {cut > 0 && <p>Modo emergência: cortando os dispensáveis você economizaria <b>{fmt(cut)}</b> por mês.</p>}
      </div>

      {/* Categorias */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 font-semibold">Essencial ou dispensável? <span className="text-xs font-normal text-muted-foreground">toque para trocar</span></div>
        {data.cats.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas nos últimos 3 meses.</p>}
        <div className="divide-y">
          {data.cats.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-2 text-sm">
              <span>{c.name} <span className="text-muted-foreground">· {fmt(c.avg)}/mês</span></span>
              <button onClick={() => setOverrides((o) => ({ ...o, [c.name]: !c.essential }))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${c.essential ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {c.essential ? "Essencial" : "Dispensável"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CostOfLivingTab;
