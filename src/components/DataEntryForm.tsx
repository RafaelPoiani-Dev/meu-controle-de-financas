import { useState } from "react";
import { Plus } from "lucide-react";

export interface Transaction {
  id: string;
  date: string;
  paymentDate?: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  installments?: number;
  currentInstallment?: number;
  creditCard?: string;
  status?: "pending" | "paid";
}

interface DataEntryFormProps {
  onAdd: (transaction: Omit<Transaction, "id">) => void;
  categoriesByType?: Record<string, string[]>;
  creditCardNames?: string[];
  transactionTypes?: string[];
}

// Adds N months to a YYYY-MM-DD string without timezone conversion.
function addMonthsToDateString(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMonths = (y * 12 + (m - 1)) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  // Clamp day to last day of target month
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

const typeLabels: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
};

const typeColors: Record<string, { active: string; inactive: string }> = {
  income: { active: "bg-income text-primary-foreground", inactive: "bg-card text-muted-foreground hover:bg-muted" },
  expense: { active: "bg-expense text-primary-foreground", inactive: "bg-card text-muted-foreground hover:bg-muted" },
};

const defaultActive = "bg-primary text-primary-foreground";
const defaultInactive = "bg-card text-muted-foreground hover:bg-muted";

const DataEntryForm = ({ onAdd, categoriesByType = {}, creditCardNames = [], transactionTypes = ["income", "expense"] }: DataEntryFormProps) => {
  const [type, setType] = useState(transactionTypes[0] || "expense");
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [date, setDate] = useState(today);
  const [paymentDate, setPaymentDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState("2");
  const [creditCard, setCreditCard] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState("12");

  const categoryList = categoriesByType[type] || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !category || !amount) return;
    if (isInstallment && !creditCard) return;

    const totalAmount = parseFloat(amount);
    const numInstallments = parseInt(installments);

    if (isInstallment && creditCard) {
      const perInstallment = totalAmount / numInstallments;
      onAdd({
        date,
        paymentDate: paymentDate || undefined,
        description,
        category,
        type,
        amount: perInstallment,
        creditCard,
        installments: numInstallments,
        currentInstallment: 1,
        status: "pending",
      });
    } else if (isRecurring) {
      const repeats = Math.max(1, Math.min(60, parseInt(recurringMonths) || 1));
      for (let i = 0; i < repeats; i++) {
        onAdd({
          date: addMonthsToDateString(date, i),
          paymentDate: paymentDate ? addMonthsToDateString(paymentDate, i) : undefined,
          description: `${description} (${i + 1}/${repeats})`,
          category,
          type,
          amount: totalAmount,
          ...(creditCard && { creditCard }),
          status: "pending",
        });
      }
    } else {
      onAdd({
        date,
        paymentDate: paymentDate || undefined,
        description,
        category,
        type,
        amount: totalAmount,
        ...(creditCard && { creditCard }),
        status: "pending",
      });
    }

    setDescription("");
    setCategory("");
    setAmount("");
    setPaymentDate("");
    setIsInstallment(false);
    setInstallments("2");
    setCreditCard("");
    setIsRecurring(false);
    setRecurringMonths("12");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg shadow-card p-6 animate-fade-in">
      <h3 className="text-lg font-bold font-display text-card-foreground mb-4">Nova Transação</h3>

      {/* Type toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border mb-5">
        {transactionTypes.map((t) => {
          const colors = typeColors[t];
          const isActive = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory(""); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? (colors?.active || defaultActive)
                  : (colors?.inactive || defaultInactive)
              }`}
            >
              {typeLabels[t] || t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valor total (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data de pagamento</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição</label>
          <input
            type="text"
            placeholder="Ex: Supermercado, Aluguel..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecione...</option>
            {categoryList.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Meio de pagamento - show for expense type */}
        {type === "expense" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meio de pagamento</label>
            <select
              value={creditCard}
              onChange={(e) => setCreditCard(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
               <option value="">Dinheiro / Débito</option>
              {creditCardNames.map((card) => (
                <option key={card} value={card}>{card}</option>
              ))}
            </select>
          </div>
        )}

        {/* Installment toggle */}
        {type === "expense" && creditCard && (
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => {
                  setIsInstallment(e.target.checked);
                  if (e.target.checked) setIsRecurring(false);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-primary-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
            <span className="text-xs font-medium text-muted-foreground">Compra parcelada</span>
          </div>
        )}

        {/* Installment details */}
        {isInstallment && type === "expense" && creditCard && (
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                Valor por parcela: <span className="font-bold text-foreground">
                  {amount ? (parseFloat(amount) / parseInt(installments)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Recurring toggle - independent from installment */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => {
                setIsRecurring(e.target.checked);
                if (e.target.checked) setIsInstallment(false);
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-primary-foreground after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
          <span className="text-xs font-medium text-muted-foreground">Repetir mensalmente (água, luz, internet...)</span>
        </div>

        {isRecurring && !isInstallment && (
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantidade de meses</label>
              <input
                type="number"
                min="2"
                max="60"
                value={recurringMonths}
                onChange={(e) => setRecurringMonths(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                Serão criados <span className="font-bold text-foreground">{Math.max(1, Math.min(60, parseInt(recurringMonths) || 1))}</span> lançamentos mensais.
              </p>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full mt-5 gradient-warm text-primary-foreground font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-warm"
      >
        <Plus size={18} />
        Adicionar
      </button>
    </form>
  );
};

export default DataEntryForm;
