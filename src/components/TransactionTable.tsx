import { Trash2, CheckCircle2, Clock, Pencil, Inbox } from "lucide-react";
import type { Transaction } from "./DataEntryForm";
import type { ExpandedTransaction } from "@/lib/expandInstallments";

interface TransactionTableProps {
  transactions: (Transaction | ExpandedTransaction)[];
  onDelete: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onEdit?: (id: string) => void;
  showStatus?: boolean;
}

const TransactionTable = ({ transactions, onDelete, onToggleStatus, onEdit, showStatus = false }: TransactionTableProps) => {
  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card p-10 text-center animate-fade-in border border-dashed border-border">
        <div className="mx-auto w-12 h-12 rounded-full gradient-warm flex items-center justify-center text-primary-foreground mb-3">
          <Inbox size={22} />
        </div>
        <p className="text-foreground font-semibold">Nenhum lançamento por aqui</p>
        <p className="text-muted-foreground text-sm mt-1">
          Ajuste os filtros, mude o mês ou cadastre uma nova transação para começar.
        </p>
      </div>
    );
  }

  const isExpanded = (t: Transaction | ExpandedTransaction): t is ExpandedTransaction =>
    "isVirtual" in t;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalOther = transactions
    .filter((t) => t.type !== "income" && t.type !== "expense")
    .reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense - totalOther;

  return (
    <div className="bg-card rounded-lg shadow-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="gradient-warm text-primary-foreground">
              <th className="text-left text-xs font-semibold px-4 py-3">Compra</th>
              <th className="text-left text-xs font-semibold px-4 py-3">Pagamento</th>
              <th className="text-left text-xs font-semibold px-4 py-3">Descrição</th>
              <th className="text-left text-xs font-semibold px-4 py-3">Categoria</th>
              <th className="text-right text-xs font-semibold px-4 py-3">Valor</th>
              {showStatus && <th className="text-center text-xs font-semibold px-4 py-3">Status</th>}
              <th className="text-center text-xs font-semibold px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => {
              const virtual = isExpanded(t) && t.isVirtual;
              const realId = isExpanded(t) ? t.originalId ?? t.id : t.id;

              return (
                <tr
                  key={t.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${
                    i % 2 === 0 ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {t.paymentDate ? formatDate(t.paymentDate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {t.description}
                    {t.creditCard && (
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {t.creditCard}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                      {t.category}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${
                    t.type === "income" ? "text-income" : "text-expense"
                  }`}>
                    {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                  </td>
                  {showStatus && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => !virtual && onToggleStatus?.(realId)}
                        disabled={virtual}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                          t.status === "paid"
                            ? "bg-income/15 text-income"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                        } ${virtual ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        title={virtual ? "Altere o status na parcela original" : undefined}
                      >
                        {t.status === "paid" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        {t.status === "paid" ? "Pago" : "Pendente"}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    {!virtual && (
                      <div className="inline-flex items-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(realId)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(realId)}
                          className="text-muted-foreground hover:text-expense transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Entradas: <span className="font-semibold text-income">+ {formatCurrency(totalIncome)}</span>
        </span>
        <span className="text-muted-foreground">
          Saídas: <span className="font-semibold text-expense">- {formatCurrency(totalExpense + totalOther)}</span>
        </span>
        <span className="font-bold text-foreground">
          Total: <span className={net >= 0 ? "text-income" : "text-expense"}>{formatCurrency(net)}</span>
        </span>
      </div>
    </div>
  );
};

export default TransactionTable;
