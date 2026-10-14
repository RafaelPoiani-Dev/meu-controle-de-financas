import { useEffect, useState } from "react";
import { Target, Star } from "lucide-react";
import type { Goal } from "@/hooks/useGoals";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctFmt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Animates a number from 0 to `value` each time the component mounts or value changes. */
export function useCountUp(value: number, duration = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

export function GoalBar({ pct, thin }: { pct: number; thin?: boolean }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(0);
    const t = setTimeout(() => setW(Math.min(100, Math.max(0, pct))), 60);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className={`w-full rounded-full bg-muted overflow-hidden ${thin ? "h-1.5" : "h-3.5"}`}>
      <div
        className="h-full rounded-full gradient-warm shadow-warm transition-[width] duration-[1100ms] ease-out"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export interface GoalWithProgress extends Goal {
  saved: number;
  monthsLeft: number;
}

const Main = ({ g }: { g: GoalWithProgress }) => {
  const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
  const saved = useCountUp(g.saved);
  const p = useCountUp(pct);
  const missing = Math.max(0, g.target - g.saved);
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Target size={12} />Meta principal</p>
          <p className="font-bold text-foreground truncate">{g.name}</p>
        </div>
        <span className="rounded-full gradient-warm text-primary-foreground text-xs font-bold px-2.5 py-1 tabular-nums">{pctFmt(p)}</span>
      </div>
      <p className="text-sm tabular-nums">
        <span className="text-lg font-bold text-foreground">{fmt(saved)}</span>
        <span className="text-muted-foreground"> de {fmt(g.target)}</span>
      </p>
      <GoalBar pct={pct} />
      <p className="text-xs text-muted-foreground">
        {missing === 0 ? "Meta atingida! 🎉" : `Faltam ${fmt(missing)}${g.monthsLeft > 0 ? ` • média de ${fmt(missing / g.monthsLeft)}/mês` : ""}`}
      </p>
    </div>
  );
};

const Mini = ({ g, onMain }: { g: GoalWithProgress; onMain?: (id: string) => void }) => {
  const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
  const p = useCountUp(pct);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-foreground font-medium">{g.name}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold tabular-nums text-foreground">{pctFmt(p)}</span>
          {onMain && (
            <button onClick={() => onMain(g.id)} title="Tornar principal" className="text-muted-foreground hover:text-primary"><Star size={12} /></button>
          )}
        </span>
      </div>
      <GoalBar pct={pct} thin />
    </div>
  );
};

const GoalsProgress = ({ goals, onMain, onOpen }: { goals: GoalWithProgress[]; onMain?: (id: string) => void; onOpen?: () => void }) => {
  if (goals.length === 0) {
    return (
      <button onClick={onOpen} className="w-full rounded-3xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2">
        <Target size={16} />Criar uma meta de economia
      </button>
    );
  }
  const main = goals.find((g) => g.isMain) ?? goals[0];
  const others = goals.filter((g) => g.id !== main.id);
  return (
    <section className="rounded-3xl bg-card border border-border shadow-card p-5 space-y-4">
      <Main g={main} />
      {others.length > 0 && (
        <div className="space-y-2.5 border-t border-border pt-3">
          {others.map((g) => <Mini key={g.id} g={g} onMain={onMain} />)}
        </div>
      )}
    </section>
  );
};

export default GoalsProgress;
