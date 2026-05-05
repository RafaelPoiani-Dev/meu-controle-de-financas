import { useState } from "react";
import { Upload, FileText, Loader2, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Transaction } from "./DataEntryForm";

interface ParsedItem {
  date: string;
  description: string;
  amount: number;
  installment?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  creditCardNames: string[];
  categories: string[];
  existingTransactions: Transaction[];
  onImport: (transactions: Omit<Transaction, "id">[]) => Promise<void> | void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

export default function InvoiceImportDialog({
  open,
  onClose,
  creditCardNames,
  categories,
  existingTransactions,
  onImport,
}: Props) {
  const [card, setCard] = useState<string>(creditCardNames[0] ?? "");
  const [category, setCategory] = useState<string>(categories[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const reset = () => {
    setParsed(null);
    setSelected(new Set());
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!card) {
      toast.error("Selecione o cartão da fatura");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF muito grande (máx 10MB)");
      return;
    }

    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid stack overflow
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const pdfBase64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("parse-invoice-pdf", {
        body: { pdfBase64, fileName: file.name },
      });

      if (error) {
        toast.error(error.message || "Erro ao processar PDF");
        return;
      }
      const items: ParsedItem[] = data?.transactions ?? [];
      if (items.length === 0) {
        toast.error("Nenhuma transação encontrada no PDF");
        return;
      }

      // Pre-select items not yet present in existing transactions for this card
      const existingKeys = new Set(
        existingTransactions
          .filter((t) => t.creditCard === card)
          .map((t) => `${t.date}|${norm(t.description)}|${t.amount.toFixed(2)}`),
      );
      const preSel = new Set<number>();
      items.forEach((it, idx) => {
        const key = `${it.date}|${norm(it.description)}|${Math.abs(it.amount).toFixed(2)}`;
        if (!existingKeys.has(key)) preSel.add(idx);
      });

      setParsed(items);
      setSelected(preSel);
      toast.success(`${items.length} transação(ões) lidas — ${preSel.size} faltando`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ler PDF");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = async () => {
    if (!parsed || selected.size === 0) return;
    setLoading(true);
    try {
      const toAdd: Omit<Transaction, "id">[] = [];
      parsed.forEach((it, idx) => {
        if (!selected.has(idx)) return;
        const isRefund = it.amount < 0;
        let installments: number | undefined;
        let currentInstallment: number | undefined;
        if (it.installment && it.installment.includes("/")) {
          const [cur, total] = it.installment.split("/").map((n) => parseInt(n, 10));
          if (!isNaN(cur) && !isNaN(total)) {
            installments = total;
            currentInstallment = cur;
          }
        }
        toAdd.push({
          date: it.date,
          description: it.description,
          category,
          type: isRefund ? "income" : "expense",
          amount: Math.abs(it.amount),
          creditCard: card,
          installments,
          currentInstallment,
          status: "pending",
        });
      });
      await onImport(toAdd);
      toast.success(`${toAdd.length} transação(ões) importada(s)!`);
      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const missingCount = parsed
    ? parsed.filter((it) => {
        const existingKeys = new Set(
          existingTransactions
            .filter((t) => t.creditCard === card)
            .map((t) => `${t.date}|${norm(t.description)}|${t.amount.toFixed(2)}`),
        );
        const key = `${it.date}|${norm(it.description)}|${Math.abs(it.amount).toFixed(2)}`;
        return !existingKeys.has(key);
      }).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} /> Importar fatura (PDF)
          </DialogTitle>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Cartão</label>
                <select
                  value={card}
                  onChange={(e) => setCard(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  {creditCardNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria padrão</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:bg-muted/50 transition">
              {loading ? (
                <>
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <span className="text-sm text-muted-foreground">Lendo fatura com IA...</span>
                </>
              ) : (
                <>
                  <Upload className="mb-2 text-muted-foreground" size={32} />
                  <span className="text-sm font-medium">Clique para enviar o PDF da fatura</span>
                  <span className="text-xs text-muted-foreground mt-1">Máx 10MB</span>
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {parsed.length} lançamento(s) na fatura • <strong className="text-foreground">{missingCount} faltam</strong> no app
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set(parsed.map((_, i) => i)))}>
                  Todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Nenhum
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 w-10"></th>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((it, idx) => {
                    const existingKeys = new Set(
                      existingTransactions
                        .filter((t) => t.creditCard === card)
                        .map((t) => `${t.date}|${norm(t.description)}|${t.amount.toFixed(2)}`),
                    );
                    const key = `${it.date}|${norm(it.description)}|${Math.abs(it.amount).toFixed(2)}`;
                    const exists = existingKeys.has(key);
                    return (
                      <tr key={idx} className={`border-t border-border ${exists ? "opacity-60" : ""}`}>
                        <td className="p-2">
                          <Checkbox
                            checked={selected.has(idx)}
                            onCheckedChange={() => toggle(idx)}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{it.date}</td>
                        <td className="p-2">
                          {it.description}
                          {it.installment && (
                            <span className="ml-2 text-xs text-muted-foreground">({it.installment})</span>
                          )}
                        </td>
                        <td className={`p-2 text-right font-medium ${it.amount < 0 ? "text-income" : "text-foreground"}`}>
                          {fmt(it.amount)}
                        </td>
                        <td className="p-2 text-center">
                          {exists ? (
                            <span title="Já lançado" className="inline-flex"><Check size={16} className="text-income" /></span>
                          ) : (
                            <span title="Falta" className="inline-flex"><X size={16} className="text-expense" /></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={reset} disabled={loading}>Voltar</Button>
              <Button onClick={handleImport} disabled={loading || selected.size === 0} className="gradient-warm text-primary-foreground">
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Importar {selected.size} lançamento(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
