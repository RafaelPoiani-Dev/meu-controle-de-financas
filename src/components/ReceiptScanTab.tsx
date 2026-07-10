import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Trash2, Receipt as ReceiptIcon, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Transaction } from "./DataEntryForm";

interface ReceiptItem {
  name: string;
  quantity?: number;
  amount: number;
  category: string;
}

interface ReceiptRow {
  id: string;
  user_id: string;
  image_url: string;
  merchant: string | null;
  total: number;
  items: ReceiptItem[];
  purchase_date: string | null;
  payment_date: string | null;
  transaction_id: string | null;
  created_at: string;

}

interface Props {
  userId: string | undefined;
  existingCategories: string[];
  creditCardNames: string[];
  addTransaction: (t: Omit<Transaction, "id">) => Promise<void> | void;
  addCategory: (name: string, type: string) => Promise<void> | void;
  selectedYear: number;
  selectedMonth: number;
}


const CATEGORY_COLORS = [
  "hsl(0, 78%, 55%)", "hsl(25, 90%, 55%)", "hsl(45, 100%, 55%)",
  "hsl(145, 65%, 42%)", "hsl(200, 70%, 50%)", "hsl(270, 60%, 55%)",
  "hsl(320, 65%, 50%)", "hsl(180, 55%, 45%)", "hsl(60, 70%, 45%)",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function signedUrlFor(path: string): Promise<string> {
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

function storagePathFromUrl(url: string): string | null {
  // stored as `${userId}/${filename}` — we saved the path in image_url
  return url;
}

const ReceiptScanTab = ({ userId, existingCategories, creditCardNames, addTransaction, addCategory, selectedYear, selectedMonth }: Props) => {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<{
    imagePath: string;
    merchant: string;
    total: number;
    purchase_date: string;
    payment_date: string;
    status: "pending" | "paid";
    top_category: string;
    items: ReceiptItem[];
    creditCard: string;
  } | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cupons");
    setReceipts(((data ?? []) as any[]).map((r) => ({ ...r, items: (r.items ?? []) as ReceiptItem[] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  // Sign URLs for thumbnails
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = { ...signedUrls };
      for (const r of receipts) {
        if (!map[r.id]) map[r.id] = await signedUrlFor(r.image_url);
      }
      setSignedUrls(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts]);

  const handleFile = async (file: File) => {
    if (!userId) return;
    setAnalyzing(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 10);
      const signedUrl = signed?.signedUrl;
      if (!signedUrl) throw new Error("Falha ao gerar URL para IA");

      const { data, error } = await supabase.functions.invoke("analyze-receipt", {
        body: { imageUrl: signedUrl, existingCategories },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const parsed = data as any;
      setPreview({
        imagePath: path,
        merchant: parsed.merchant ?? "",
        total: Number(parsed.total ?? 0),
        purchase_date: parsed.purchase_date || todayStr(),
        payment_date: "",
        status: "pending",
        top_category: parsed.top_category ?? "",
        items: (parsed.items ?? []) as ReceiptItem[],
        creditCard: "",
      });
      toast.success("Cupom analisado!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao analisar cupom");
    } finally {
      setAnalyzing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const saveReceipt = async () => {
    if (!preview || !userId) return;
    try {
      // Persist any new categories detected by the AI (top + per-item) into user settings
      const categoryToUse = preview.top_category || preview.items[0]?.category || "Outros";
      const knownLower = new Set(existingCategories.map((c) => c.toLowerCase()));
      const toCreate = new Set<string>();
      if (categoryToUse && !knownLower.has(categoryToUse.toLowerCase())) toCreate.add(categoryToUse);
      preview.items.forEach((it) => {
        const c = (it.category || "").trim();
        if (c && !knownLower.has(c.toLowerCase())) toCreate.add(c);
      });
      for (const name of toCreate) {
        await addCategory(name, "expense");
      }

      // Create transaction with total
      await addTransaction({
        date: preview.purchase_date || todayStr(),
        paymentDate: preview.payment_date || undefined,
        description: `Cupom${preview.merchant ? ` — ${preview.merchant}` : ""}`,
        category: categoryToUse,
        type: "expense",
        amount: preview.total,
        ...(preview.creditCard && { creditCard: preview.creditCard }),
        status: preview.status,
      });

      const { error } = await supabase.from("receipts").insert({
        user_id: userId,
        image_url: preview.imagePath,
        merchant: preview.merchant,
        total: preview.total,
        items: preview.items as any,
        purchase_date: preview.purchase_date || null,
        payment_date: preview.payment_date || null,
      } as any);
      if (error) throw error;

      toast.success("Cupom salvo e lançamento criado!");
      setPreview(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const deleteReceipt = async (r: ReceiptRow) => {
    if (!confirm("Excluir este cupom?")) return;
    await supabase.storage.from("receipts").remove([r.image_url]);
    await supabase.from("receipts").delete().eq("id", r.id);
    toast.success("Cupom excluído");
    load();
  };

  const updateItem = (idx: number, patch: Partial<ReceiptItem>) => {
    if (!preview) return;
    const items = preview.items.map((it, i) => i === idx ? { ...it, ...patch } : it);
    setPreview({ ...preview, items });
  };

  const removeItem = (idx: number) => {
    if (!preview) return;
    setPreview({ ...preview, items: preview.items.filter((_, i) => i !== idx) });
  };

  // Filter receipts by selected month/year using PAYMENT date (falls back to purchase date for legacy rows)
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const filteredReceipts = useMemo(
    () => receipts.filter((r) => {
      const d = r.payment_date ?? r.purchase_date ?? r.created_at.slice(0, 10);
      return d.startsWith(monthKey);
    }),
    [receipts, monthKey]
  );


  // Aggregate spending by category across filtered receipts
  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReceipts.forEach((r) => {
      r.items.forEach((it) => {
        map[it.category] = (map[it.category] ?? 0) + Number(it.amount || 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredReceipts]);


  const topCategory = spendingByCategory[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upload */}
      <div className="bg-card rounded-lg shadow-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <ReceiptIcon className="text-primary" size={22} />
          <h3 className="text-lg font-bold font-display">Escanear Cupom Fiscal</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Tire ou envie a foto do cupom. A IA identifica os itens, categorias e o valor total, e cria o lançamento automaticamente.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={analyzing}
          className="gradient-warm text-primary-foreground font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-warm disabled:opacity-60"
        >
          {analyzing ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
          {analyzing ? "Analisando com IA..." : "Tirar / Enviar foto"}
        </button>
      </div>

      {/* Preview + edit */}
      {preview && (
        <div className="bg-card rounded-lg shadow-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            <h3 className="font-bold font-display">Confira antes de salvar</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Estabelecimento</label>
              <input value={preview.merchant} onChange={(e) => setPreview({ ...preview, merchant: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
              <input type="date" value={preview.purchase_date} onChange={(e) => setPreview({ ...preview, purchase_date: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Total (R$)</label>
              <input type="number" step="0.01" value={preview.total}
                onChange={(e) => setPreview({ ...preview, total: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Data de pagamento</label>
              <input type="date" value={preview.payment_date} onChange={(e) => setPreview({ ...preview, payment_date: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={preview.status} onChange={(e) => setPreview({ ...preview, status: e.target.value as "pending" | "paid" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Meio de pagamento</label>
              <select value={preview.creditCard} onChange={(e) => setPreview({ ...preview, creditCard: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Dinheiro / Débito</option>
                {creditCardNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Itens detectados ({preview.items.length}) — categoria destaque: <span className="text-primary">{preview.top_category}</span>
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {preview.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/40 rounded-md p-2">
                  <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })}
                    className="col-span-5 rounded border border-input bg-background px-2 py-1 text-xs" />
                  <input value={it.category} onChange={(e) => updateItem(i, { category: e.target.value })}
                    className="col-span-4 rounded border border-input bg-background px-2 py-1 text-xs" placeholder="Categoria" />
                  <input type="number" step="0.01" value={it.amount}
                    onChange={(e) => updateItem(i, { amount: parseFloat(e.target.value) || 0 })}
                    className="col-span-2 rounded border border-input bg-background px-2 py-1 text-xs text-right" />
                  <button onClick={() => removeItem(i)} className="col-span-1 text-destructive hover:opacity-70 flex justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
            <button onClick={saveReceipt} className="gradient-warm text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold shadow-warm">
              Salvar cupom + criar lançamento
            </button>
          </div>
        </div>
      )}

      {/* Analytics */}
      {filteredReceipts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card rounded-lg shadow-card border border-border p-5">
            <h3 className="text-sm font-bold font-display mb-2">Gastos por Categoria (mês selecionado)</h3>

            {topCategory && (
              <p className="text-xs text-muted-foreground mb-3">
                Mais gasta: <span className="font-semibold text-foreground">{topCategory.name}</span> — {fmt(topCategory.value)}
              </p>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={spendingByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {spendingByCategory.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-lg shadow-card border border-border p-5">
            <h3 className="text-sm font-bold font-display mb-4">Ranking de gastos</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendingByCategory.slice(0, 8)} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 88%)" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="hsl(25, 90%, 55%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* List of receipts */}
      <div>
        <h3 className="text-sm font-bold font-display mb-3">Cupons do mês selecionado</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filteredReceipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {receipts.length === 0
              ? "Nenhum cupom ainda. Envie o primeiro acima!"
              : "Nenhum cupom neste mês. Selecione outro mês acima."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredReceipts.map((r) => (
              <div key={r.id} className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
                {signedUrls[r.id] ? (
                  <a href={signedUrls[r.id]} target="_blank" rel="noreferrer" className="block bg-muted">
                    <img src={signedUrls[r.id]} alt={r.merchant ?? "cupom"} className="w-full h-40 object-cover" />
                  </a>
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground">
                    <ImageIcon size={28} />
                  </div>
                )}
                <div className="p-3 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-sm truncate">{r.merchant ?? "Cupom"}</p>
                    <button onClick={() => deleteReceipt(r)} className="text-destructive hover:opacity-70">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.purchase_date ?? r.created_at.slice(0, 10)} • {r.items.length} itens</p>
                  <p className="text-sm font-bold text-primary">{fmt(Number(r.total))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default ReceiptScanTab;
