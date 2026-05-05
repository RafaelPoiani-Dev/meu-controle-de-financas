import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Transaction } from "./DataEntryForm";

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Transaction, "id">>) => void;
  onCreateRecurring?: (base: Omit<Transaction, "id">, months: number) => void;
  categoriesByType?: Record<string, string[]>;
  creditCardNames?: string[];
  transactionTypes?: string[];
}

function addMonthsToDateString(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMonths = (y * 12 + (m - 1)) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

const typeLabels: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
};

const EditTransactionDialog = ({
  transaction,
  open,
  onClose,
  onSave,
  onCreateRecurring,
  categoriesByType = {},
  creditCardNames = [],
  transactionTypes = ["income", "expense"],
}: EditTransactionDialogProps) => {
  const [date, setDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [creditCard, setCreditCard] = useState("");
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [createRecurring, setCreateRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState("11");

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setPaymentDate(transaction.paymentDate ?? "");
      setDescription(transaction.description);
      setCategory(transaction.category);
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCreditCard(transaction.creditCard ?? "");
      setStatus(transaction.status ?? "pending");
      setCreateRecurring(false);
      setRecurringMonths("11");
    }
  }, [transaction]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !transaction) return null;

  const categoryList = categoriesByType[type] || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    onSave(transaction.id, {
      date,
      paymentDate: paymentDate || undefined,
      description,
      category,
      type,
      amount: amt,
      creditCard: creditCard || undefined,
      status,
    });

    if (createRecurring && onCreateRecurring) {
      const repeats = Math.max(1, Math.min(60, parseInt(recurringMonths) || 1));
      onCreateRecurring(
        {
          date,
          paymentDate: paymentDate || undefined,
          description,
          category,
          type,
          amount: amt,
          ...(creditCard && { creditCard }),
          status: "pending",
        },
        repeats,
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-card rounded-lg shadow-warm w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-bold font-display text-card-foreground">Editar Transação</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 grid gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setCategory(""); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {transactionTypes.map((t) => (
                <option key={t} value={t}>{typeLabels[t] || t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data de pagamento</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Selecione...</option>
              {categoryList.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              {category && !categoryList.includes(category) && (
                <option value={category}>{category}</option>
              )}
            </select>
          </div>

          {type === "expense" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meio de pagamento</label>
              <select
                value={creditCard}
                onChange={(e) => setCreditCard(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Dinheiro / Débito</option>
                {creditCardNames.map((card) => (
                  <option key={card} value={card}>{card}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "paid")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
            </select>
          </div>

          {onCreateRecurring && !transaction.installments && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createRecurring}
                    onChange={(e) => setCreateRecurring(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-primary-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-xs font-medium text-muted-foreground">Repetir nos próximos meses</span>
              </div>
              {createRecurring && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantos meses adicionais</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={recurringMonths}
                    onChange={(e) => setRecurringMonths(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Serão criados <span className="font-bold text-foreground">{Math.max(1, Math.min(60, parseInt(recurringMonths) || 1))}</span> novos lançamentos a partir do próximo mês.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 gradient-warm text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionDialog;
