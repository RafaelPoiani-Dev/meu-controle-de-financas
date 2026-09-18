import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/components/DataEntryForm";

export interface SheetEntry {
  date: string;
  payment_date?: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  credit_card?: string;
  status?: "pending" | "paid";
  installments?: number;
  current_installment?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: { name: string; type: string }[];
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, "id">) => Promise<void> | void;
  addCategory: (name: string, type: string) => Promise<void> | void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const keyOf = (date: string, description: string, amount: number) =>
  `${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`;

export default function SheetImportDialog({
  open,
  onOpenChange,
  existingCategories,
  transactions,
  addTransaction,
  addCategory,
}: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [entries, setEntries] = useState<SheetEntry[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const existingKeys = new Set(
    transactions.map((t) => keyOf(t.date, t.description, t.amount)),
  );

  const reset = () => {
    setEntries(null);
    setSelected({});
  };

  const handleRead = async () => {
    if (!url.trim()) return;
    setLoading(true);
    reset();
    try {
      const { data, error } = await supabase.functions.invoke("import-google-sheet", {
        body: { url, existingCategories: existingCategories.map((c) => c.name) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: SheetEntry[] = (data?.entries ?? []).filter(
        (e: SheetEntry) => e?.date && e?.description && Number(e.amount) > 0,
      );
      if (!list.length) {
        toast.error("Nenhum lançamento encontrado na aba Lançamentos.");
        return;
      }
      setEntries(list);
      const preSelected: Record<number, boolean> = {};
      list.forEach((e, i) => {
        preSelected[i] = !existingKeys.has(keyOf(e.date, e.description, Number(e.amount)));
      });
      setSelected(preSelected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao ler a planilha";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!entries) return;
    const chosen = entries.filter((_, i) => selected[i]);
    if (!chosen.length) {
      toast.error("Selecione ao menos um lançamento.");
      return;
    }
    setImporting(true);
    try {
      const known = new Set(
        existingCategories.map((c) => `${c.name.toLowerCase()}|${c.type}`),
      );
      for (const e of chosen) {
        const cat = (e.category || "Outros").trim();
        const type = e.type === "income" ? "income" : "expense";
        const catKey = `${cat.toLowerCase()}|${type}`;
        if (!known.has(catKey)) {
          known.add(catKey);
          await addCategory(cat, type);
        }
        await addTransaction({
          date: e.date,
          paymentDate: e.payment_date || undefined,
          description: e.description,
          category: cat,
          type,
          amount: Number(e.amount),
          creditCard: e.credit_card || undefined,
          status: e.status === "paid" ? "paid" : "pending",
          installments: e.installments && e.installments > 1 ? e.installments : undefined,
          currentInstallment:
            e.installments && e.installments > 1 ? e.current_installment || 1 : undefined,
        });
      }
      toast.success(`${chosen.length} lançamento(s) importado(s)!`);
      onOpenChange(false);
      reset();
      setUrl("");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar planilha do Google
          </DialogTitle>
          <DialogDescription>
            Cole o link da planilha. Ela precisa estar compartilhada como "qualquer pessoa
            com o link pode ver" e ter a aba <strong>Lançamentos</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sheet-url">Link da planilha</Label>
          <div className="flex gap-2">
            <Input
              id="sheet-url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRead(); }}
            />
            <Button onClick={handleRead} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ler"}
            </Button>
          </div>
        </div>

        {entries && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {entries.length} lançamento(s) encontrados · {selectedCount} selecionados
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const all = selectedCount !== entries.length;
                  const next: Record<number, boolean> = {};
                  entries.forEach((_, i) => (next[i] = all));
                  setSelected(next);
                }}
              >
                {selectedCount === entries.length ? "Desmarcar todos" : "Marcar todos"}
              </Button>
            </div>

            <div className="space-y-2">
              {entries.map((e, i) => {
                const duplicate = existingKeys.has(keyOf(e.date, e.description, Number(e.amount)));
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [i]: !!v }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{e.description}</p>
                        <span
                          className={`font-bold whitespace-nowrap ${e.type === "income" ? "text-income" : "text-expense"}`}
                        >
                          {fmt(Number(e.amount))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Compra: {e.date}
                        {e.payment_date ? ` · Pagamento: ${e.payment_date}` : ""} · {e.category}
                        {e.credit_card ? ` · ${e.credit_card}` : ""} ·{" "}
                        {e.status === "paid" ? "Pago" : "Pendente"}
                      </p>
                      {duplicate && (
                        <p className="text-xs text-muted-foreground italic">Já existe no app</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                `Importar ${selectedCount} lançamento(s)`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
