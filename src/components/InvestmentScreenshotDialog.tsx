import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ImagePlus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "./DataEntryForm";
import type { Goal } from "@/hooks/useGoals";
import { findDuplicates, type InvestmentMove } from "@/lib/investmentDuplicates";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function compress(file: File): Promise<string> {
  const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const ctx = c.getContext("2d"); if (!ctx) return url;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goals: Goal[];
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, "id">) => Promise<void> | void;
}

export default function InvestmentScreenshotDialog({ open, onOpenChange, goals, transactions, addTransaction }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [moves, setMoves] = useState<InvestmentMove[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [goalId, setGoalId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const goal = goals.find((g) => g.id === goalId) ?? goals.find((g) => g.isMain) ?? goals[0];
  const dups = moves && goal ? findDuplicates(moves, transactions, goal.category) : [];

  const close = (o: boolean) => { if (!o) { setImages([]); setMoves(null); setSelected({}); } onOpenChange(o); };

  const preselect = (list: InvestmentMove[], cat: string) => {
    const d = findDuplicates(list, transactions, cat);
    setSelected(Object.fromEntries(list.map((_, i) => [i, !d[i]])));
  };

  const read = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-investment-screenshot", { body: { images } });
      if (error || data?.error) throw new Error(data?.error || "Não consegui ler os prints.");
      const list: InvestmentMove[] = data.moves ?? [];
      if (!list.length) { toast.error("Nenhuma movimentação encontrada nos prints."); return; }
      list.sort((a, b) => a.date.localeCompare(b.date));
      setMoves(list);
      if (goal) preselect(list, goal.category);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ler os prints");
    } finally { setLoading(false); }
  };

  const update = (i: number, patch: Partial<InvestmentMove>) =>
    setMoves((m) => m && m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeRow = (i: number) => {
    setMoves((m) => m && m.filter((_, j) => j !== i));
    setSelected((s) => { const n: Record<number, boolean> = {}; Object.entries(s).forEach(([k, v]) => { const ki = +k; if (ki < i) n[ki] = v; else if (ki > i) n[ki - 1] = v; }); return n; });
  };

  const chosen = (moves ?? []).filter((_, i) => selected[i]);
  const dep = chosen.filter((m) => m.kind === "deposit").reduce((s, m) => s + Number(m.amount), 0);
  const wd = chosen.filter((m) => m.kind === "withdraw").reduce((s, m) => s + Number(m.amount), 0);

  const save = async () => {
    if (!goal || !chosen.length) return;
    setSaving(true);
    try {
      for (const m of chosen) {
        await addTransaction({
          date: m.date, paymentDate: m.date, description: m.description,
          category: goal.category, type: m.kind === "withdraw" ? "income" : "expense",
          amount: Number(m.amount), status: "paid",
        } as Omit<Transaction, "id">);
      }
      toast.success(`${chosen.length} movimentações adicionadas à meta "${goal.name}"`);
      close(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ler prints de investimentos</DialogTitle>
          <DialogDescription>Envie prints das aplicações e resgates do seu banco. Você confere tudo antes de salvar.</DialogDescription>
        </DialogHeader>

        {goals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Crie uma meta primeiro.</p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">Lançar na meta
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={goal?.id}
                onChange={(e) => { setGoalId(e.target.value); const g = goals.find((x) => x.id === e.target.value); if (moves && g) preselect(moves, g.category); }}>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.category})</option>)}
              </select>
            </label>

            {!moves && (
              <>
                <input ref={inputRef} type="file" accept="image/*" multiple hidden
                  onChange={async (e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; try { const l = await Promise.all(f.map(compress)); setImages((p) => [...p, ...l].slice(0, 8)); } catch { toast.error("Não consegui abrir uma imagem."); } }} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt={`Print ${i + 1}`} className="h-24 w-full rounded-lg object-cover border border-border" />
                      <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5" aria-label="Remover print"><X size={14} /></button>
                    </div>
                  ))}
                  {images.length < 8 && (
                    <button onClick={() => inputRef.current?.click()} className="flex h-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
                      <ImagePlus size={20} />Adicionar
                    </button>
                  )}
                </div>
                <Button className="w-full" disabled={!images.length || loading} onClick={read}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lendo prints…</> : "Ler movimentações"}
                </Button>
              </>
            )}

            {moves && (
              <>
                {dups.some(Boolean) && (
                  <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {dups.filter(Boolean).length} movimentação(ões) parecem duplicadas (mesma data, tipo e valor) e foram desmarcadas. Marque se quiser salvar mesmo assim.
                  </p>
                )}
                <div className="space-y-2">
                  {moves.map((m, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border p-2 ${dups[i] ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                      <Checkbox className="mt-2" checked={!!selected[i]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [i]: !!v }))} />
                      <div className="flex-1 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          <Input type="date" value={m.date} onChange={(e) => update(i, { date: e.target.value })} />
                          <select value={m.kind} onChange={(e) => update(i, { kind: e.target.value as InvestmentMove["kind"] })}
                            className={`rounded-md border border-input bg-background px-2 text-sm font-semibold ${m.kind === "deposit" ? "text-income" : "text-expense"}`}>
                            <option value="deposit">Aporte (+)</option>
                            <option value="withdraw">Saque (−)</option>
                          </select>
                          <Input inputMode="decimal" value={m.amount} onChange={(e) => update(i, { amount: Number(e.target.value.replace(",", ".")) || 0 })} />
                          <Input className="col-span-2 sm:col-span-1" value={m.description} onChange={(e) => update(i, { description: e.target.value })} />
                        </div>
                        {dups[i] && <p className="text-xs font-semibold text-primary">{dups[i] === "app" ? "Possível duplicado: já existe no app" : "Possível duplicado: repetido nestes prints"}</p>}
                      </div>
                      <button onClick={() => removeRow(i)} className="mt-2 text-muted-foreground hover:text-expense" aria-label="Excluir linha"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Aportes</span><span className="text-income font-semibold">+ {fmt(dep)}</span></div>
                  <div className="flex justify-between"><span>Saques</span><span className="text-expense font-semibold">− {fmt(wd)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1 font-bold"><span>Líquido na meta</span><span>{fmt(dep - wd)}</span></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMoves(null)}>Voltar</Button>
                  <Button className="flex-1" disabled={!chosen.length || saving} onClick={save}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar {chosen.length} na meta
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
