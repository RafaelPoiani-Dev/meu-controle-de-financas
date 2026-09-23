import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ImagePlus, X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/components/DataEntryForm";

export interface ScreenshotEntry {
  date: string;
  payment_date: string;
  description: string;
  category: string;
  type: "income" | "expense";
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
  creditCardNames: string[];
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, "id">) => Promise<void> | void;
  addCategory: (name: string, type: string) => Promise<void> | void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const monthLabel = (dateStr: string) => {
  const [y, m] = (dateStr || "").split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return "—";
  return `${MONTHS[idx]}/${y}`;
};

const keyOf = (date: string, description: string, amount: number) =>
  `${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não consegui ler a imagem"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Imagem inválida"));
    el.src = dataUrl;
  });
  const max = 1800;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ScreenshotImportDialog({
  open,
  onOpenChange,
  existingCategories,
  creditCardNames,
  transactions,
  addTransaction,
  addCategory,
}: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [entries, setEntries] = useState<ScreenshotEntry[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const existingKeys = new Set(transactions.map((t) => keyOf(t.date, t.description, t.amount)));
  const knownCategories = new Set(existingCategories.map((c) => c.name.trim().toLowerCase()));

  const reset = () => {
    setEntries(null);
    setSelected({});
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const list = await Promise.all(Array.from(files).slice(0, 8).map(fileToCompressedDataUrl));
      setImages((prev) => [...prev, ...list].slice(0, 8));
      reset();
    } catch {
      toast.error("Não consegui abrir uma das imagens.");
    }
  };

  const handleRead = async () => {
    if (!images.length) return;
    setLoading(true);
    reset();
    try {
      const { data, error } = await supabase.functions.invoke("parse-spreadsheet-screenshot", {
        body: {
          images,
          existingCategories: existingCategories.map((c) => c.name),
          creditCards: creditCardNames,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: ScreenshotEntry[] = (data?.entries ?? [])
        .filter((e: ScreenshotEntry) => e?.description && Number(e.amount) > 0)
        .map((e: ScreenshotEntry) => ({
          ...e,
          type: e.type === "income" ? "income" : "expense",
          amount: Number(e.amount),
          date: e.date || e.payment_date,
          payment_date: e.payment_date || e.date,
          category: (e.category || "Outros").trim(),
        }));
      if (!list.length) {
        toast.error("Não encontrei lançamentos nos prints enviados.");
        return;
      }
      setEntries(list);
      const pre: Record<number, boolean> = {};
      list.forEach((e, i) => {
        pre[i] = !existingKeys.has(keyOf(e.date, e.description, e.amount));
      });
      setSelected(pre);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler os prints");
    } finally {
      setLoading(false);
    }
  };

  const update = (index: number, patch: Partial<ScreenshotEntry>) => {
    setEntries((prev) => prev?.map((e, i) => (i === index ? { ...e, ...patch } : e)) ?? prev);
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
      const known = new Set(existingCategories.map((c) => `${c.name.toLowerCase()}|${c.type}`));
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
          paymentDate: e.payment_date || e.date,
          description: e.description,
          category: cat,
          type,
          amount: Number(e.amount),
          creditCard: e.credit_card || undefined,
          status: e.status === "pending" ? "pending" : "paid",
          installments: e.installments && e.installments > 1 ? e.installments : undefined,
          currentInstallment:
            e.installments && e.installments > 1 ? e.current_installment || 1 : undefined,
        });
      }
      toast.success(`${chosen.length} lançamento(s) salvo(s)!`);
      onOpenChange(false);
      reset();
      setImages([]);
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const chosenEntries = entries?.filter((_, i) => selected[i]) ?? [];
  const totalIn = chosenEntries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = chosenEntries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const newCategories = Array.from(
    new Set(
      chosenEntries
        .map((e) => (e.category || "Outros").trim())
        .filter((c) => !knownCategories.has(c.toLowerCase())),
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> Ler print da planilha
          </DialogTitle>
          <DialogDescription>
            Envie um ou vários prints da sua planilha. Cada lançamento entra no mês do
            <strong> pagamento</strong>, mesmo que a compra seja de meses anteriores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" /> Adicionar prints
            </Button>
            <Button onClick={handleRead} disabled={loading || !images.length}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo...
                </>
              ) : (
                "Ler prints"
              )}
            </Button>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`print ${i + 1}`} className="h-24 w-24 rounded-lg border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImages((prev) => prev.filter((_, idx) => idx !== i));
                      reset();
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    aria-label="Remover print"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {entries && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {entries.length} lançamento(s) lidos · {selectedCount} selecionados
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

            {newCategories.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                Novas categorias que serão criadas: <strong>{newCategories.join(", ")}</strong>
              </div>
            )}

            <div className="space-y-2">
              {entries.map((e, i) => {
                const duplicate = existingKeys.has(keyOf(e.date, e.description, Number(e.amount)));
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [i]: !!v }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={e.description}
                          onChange={(ev) => update(i, { description: ev.target.value })}
                          className="h-8 flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={e.amount}
                          onChange={(ev) => update(i, { amount: Number(ev.target.value) })}
                          className={`h-8 w-28 text-right font-bold ${e.type === "income" ? "text-income" : "text-expense"}`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="text-[11px] text-muted-foreground">
                          Compra
                          <Input
                            type="date"
                            value={e.date}
                            onChange={(ev) => update(i, { date: ev.target.value })}
                            className="h-8"
                          />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          Pagamento
                          <Input
                            type="date"
                            value={e.payment_date}
                            onChange={(ev) => update(i, { payment_date: ev.target.value })}
                            className="h-8"
                          />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          Categoria
                          <Input
                            value={e.category}
                            onChange={(ev) => update(i, { category: ev.target.value })}
                            className="h-8"
                            list="screenshot-categories"
                          />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          Tipo
                          <select
                            value={e.type}
                            onChange={(ev) => update(i, { type: ev.target.value as "income" | "expense" })}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                          </select>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vai para o mês de <strong>{monthLabel(e.payment_date || e.date)}</strong>
                        {e.credit_card ? ` · ${e.credit_card}` : ""} ·{" "}
                        {e.status === "pending" ? "Pendente" : "Pago"}
                        {duplicate ? " · já existe no app" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <datalist id="screenshot-categories">
              {existingCategories.map((c) => (
                <option key={`${c.name}-${c.type}`} value={c.name} />
              ))}
            </datalist>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <span className="text-income">Entradas: {fmt(totalIn)}</span>
              <span className="text-expense">Saídas: {fmt(totalOut)}</span>
              <span className="font-bold">Saldo: {fmt(totalIn - totalOut)}</span>
            </div>

            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                `Salvar ${selectedCount} lançamento(s)`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
