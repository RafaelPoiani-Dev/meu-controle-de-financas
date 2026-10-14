import { useState } from "react";
import { Pencil, Trash2, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Transaction } from "./DataEntryForm";
import type { Goal } from "@/hooks/useGoals";
import { goalContributions } from "@/hooks/useGoals";
import GoalsProgress, { GoalBar, type GoalWithProgress } from "./GoalsProgress";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

interface Props {
  goals: GoalWithProgress[];
  transactions: Transaction[];
  categories: string[];
  year: number;
  onSave: (g: Omit<Goal, "id"> & { id?: string }) => void;
  onRemove: (id: string) => void;
  onMain: (id: string) => void;
}

const empty = (year: number) => ({ name: "", target: "", deadline: `${year}-12-31`, category: "Investimentos", isMain: false });

const GoalsTab = ({ goals, transactions, categories, year, onSave, onRemove, onMain }: Props) => {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState(empty(year));
  const [viewId, setViewId] = useState<string | null>(null);

  const startNew = () => { setEditId(undefined); setForm({ ...empty(year), isMain: goals.length === 0 }); setOpen(true); };
  const startEdit = (g: GoalWithProgress) => {
    setEditId(g.id);
    setForm({ name: g.name, target: String(g.target), deadline: g.deadline ?? `${year}-12-31`, category: g.category, isMain: g.isMain });
    setOpen(true);
  };
  const submit = () => {
    const target = Number(String(form.target).replace(/\./g, "").replace(",", "."));
    if (!form.name.trim() || !(target > 0)) return;
    onSave({ id: editId, name: form.name.trim(), target, deadline: form.deadline || null, category: form.category, isMain: form.isMain });
    setOpen(false);
  };

  const viewed = goals.find((g) => g.id === viewId);
  const contributions = viewed ? goalContributions(viewed, transactions, year) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Minhas metas</h2>
        <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" />Nova meta</Button>
      </div>

      <GoalsProgress goals={goals} onMain={onMain} onOpen={startNew} />

      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map((g) => {
          const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
          return (
            <div key={g.id} className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground truncate">{g.isMain && <Star size={13} className="inline mr-1 text-primary" />}{g.name}</p>
                <div className="flex gap-1 shrink-0">
                  {!g.isMain && <button title="Tornar principal" onClick={() => onMain(g.id)} className="p-1 text-muted-foreground hover:text-primary"><Star size={15} /></button>}
                  <button title="Editar" onClick={() => startEdit(g)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={15} /></button>
                  <button title="Excluir" onClick={() => confirm(`Excluir a meta "${g.name}"?`) && onRemove(g.id)} className="p-1 text-muted-foreground hover:text-expense"><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{fmt(g.saved)} de {fmt(g.target)} • {pct.toFixed(1).replace(".", ",")}%</p>
              <GoalBar pct={pct} thin />
              <p className="text-xs text-muted-foreground">Categoria: {g.category}{g.deadline ? ` • até ${br(g.deadline)}` : ""}</p>
              <button onClick={() => setViewId(g.id)} className="text-xs font-semibold text-primary hover:underline">Ver aportes</button>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar meta" : "Nova meta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">Nome<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Guardar até o fim do ano" /></label>
            <label className="block text-sm">Valor da meta (R$)<Input inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="20000" /></label>
            <label className="block text-sm">Data limite<Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            <label className="block text-sm">Categoria que soma na meta
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Array.from(new Set(["Investimentos", ...categories])).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isMain} onChange={(e) => setForm({ ...form, isMain: e.target.checked })} />Meta principal (destaque na Home)</label>
          </div>
          <DialogFooter><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewed} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aportes — {viewed?.name}</DialogTitle></DialogHeader>
          {contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento em “{viewed?.category}” neste ano.</p>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-border">
              {contributions.map((t) => (
                <li key={t.id} className="flex justify-between py-2 text-sm">
                  <span className="truncate"><span className="text-muted-foreground mr-2">{br(t.paymentDate || t.date)}</span>{t.description}</span>
                  <span className="font-semibold shrink-0">{fmt(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoalsTab;
