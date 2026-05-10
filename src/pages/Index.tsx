import { useMemo, useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  LayoutDashboard,
  PlusCircle,
  CreditCard,
  RefreshCw,
  LogOut,
  ExternalLink,
  List,
  Settings,
  FileText,
  Filter,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import SummaryCard from "../components/SummaryCard";
import DataEntryForm from "../components/DataEntryForm";
import TransactionTable from "../components/TransactionTable";
import DashboardCharts from "../components/DashboardCharts";
import MonthYearSelector from "../components/MonthYearSelector";
import SettingsTab from "../components/SettingsTab";
import EditTransactionDialog from "../components/EditTransactionDialog";
import TransactionFilters, { emptyFilters, type FilterState } from "../components/TransactionFilters";
import InvoiceImportDialog from "../components/InvoiceImportDialog";
import type { Transaction } from "../components/DataEntryForm";
import { useGoogleSheetsSync } from "../hooks/useGoogleSheetsSync";
import { useAuth } from "../hooks/useAuth";
import { useTransactions } from "../hooks/useTransactions";
import { useUserSettings } from "../hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { expandInstallments, filterByMonthYear } from "@/lib/expandInstallments";

type TabKey = "dashboard" | "entry" | "cards" | "all" | "settings";

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fieldTypeIcons: Record<string, React.ReactNode> = {
  income: <TrendingUp size={20} />,
  expense: <TrendingDown size={20} />,
  balance: <DollarSign size={20} />,
};

const Index = () => {
  const { user, signOut } = useAuth();
  const { transactions, loading, addTransaction, deleteTransaction, toggleStatus, updateTransaction } = useTransactions(user?.id);
  const settings = useUserSettings(user?.id);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const { syncToSheets, syncing } = useGoogleSheetsSync();
  const prevTransactionsRef = useRef<string>("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedCardFilter, setSelectedCardFilter] = useState<string[]>([]);
  const editingTransaction = useMemo(
    () => transactions.find((t) => t.id === editingId) ?? null,
    [transactions, editingId],
  );

  useEffect(() => {
    supabase.functions.invoke("get-spreadsheet-url").then(({ data }) => {
      if (data?.url) setSpreadsheetUrl(data.url);
    });
  }, []);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const expandedTransactions = useMemo(() => expandInstallments(transactions), [transactions]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    expandedTransactions.forEach((t) => {
      const effectiveDate = t.paymentDate || t.date;
      years.add(new Date(effectiveDate).getFullYear());
    });
    return Array.from(years).sort();
  }, [expandedTransactions]);

  const filteredTransactions = useMemo(
    () => filterByMonthYear(expandedTransactions, selectedYear, selectedMonth),
    [expandedTransactions, selectedYear, selectedMonth]
  );

  const visibleTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => {
      if (filters.categories.length > 0 && !filters.categories.includes(t.category)) return false;
      if (filters.paymentMethods.length > 0) {
        const matches = filters.paymentMethods.some((pm) =>
          pm === "__cash__" ? !t.creditCard : t.creditCard === pm
        );
        if (!matches) return false;
      }
      const effective = t.paymentDate || t.date;
      if (filters.dateFrom && effective < filters.dateFrom) return false;
      if (filters.dateTo && effective > filters.dateTo) return false;
      return true;
    });
  }, [filteredTransactions, filters]);

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>();
    settings.categories.forEach((c) => set.add(c.name));
    filteredTransactions.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [settings.categories, filteredTransactions]);

  useEffect(() => {
    const serialized = JSON.stringify(transactions);
    if (prevTransactionsRef.current && prevTransactionsRef.current !== serialized) {
      syncToSheets(transactions);
    }
    prevTransactionsRef.current = serialized;
  }, [transactions, syncToSheets]);

  const totalReserva = useMemo(
    () => filteredTransactions.filter((t) => t.type === "reserva").reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions],
  );
  const totalIncome = useMemo(
    () => filteredTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0) - totalReserva,
    [filteredTransactions, totalReserva],
  );
  const totalExpense = useMemo(
    () => filteredTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0) + totalReserva,
    [filteredTransactions, totalReserva],
  );
  const balance = totalIncome - totalExpense;

  const standardTypes = ["income", "expense", "balance"];
  const getFieldValue = (field: { fieldType: string; category?: string }) => {
    const { fieldType, category } = field;
    if (fieldType === "balance") {
      return { value: balance, trend: balance >= 0 ? "Positivo ✓" : "Negativo ✗", type: "balance" };
    }
    let txs: typeof filteredTransactions;
    if (category) {
      // Match by category across ALL transaction types
      txs = filteredTransactions.filter((t) => t.category === category);
    } else if (standardTypes.includes(fieldType)) {
      txs = filteredTransactions.filter((t) => t.type === fieldType);
    } else {
      // Non-standard fieldType (e.g. "Reserva") — match by category name across all types
      txs = filteredTransactions.filter((t) => t.category?.toLowerCase() === fieldType.toLowerCase());
    }
    const total = txs.reduce((sum, t) => sum + t.amount, 0);
    return { value: total, trend: category || "Total do período", type: fieldType };
  };

  // Card limits from settings
  const cardLimitsMap = useMemo(() => {
    const m: Record<string, number> = {};
    settings.creditCards.forEach((c) => { m[c.name] = c.cardLimit; });
    return m;
  }, [settings.creditCards]);

  const cardNames = useMemo(() => {
    const fromTransactions = filteredTransactions
      .filter((t) => t.type === "expense" && t.creditCard)
      .map((t) => t.creditCard as string);
    return Array.from(new Set([...settings.creditCards.map((c) => c.name), ...fromTransactions]));
  }, [settings.creditCards, filteredTransactions]);

  const spentByCard = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "expense" && t.creditCard)
      .reduce<Record<string, number>>((acc, t) => {
        const card = t.creditCard as string;
        acc[card] = (acc[card] ?? 0) + t.amount;
        return acc;
      }, {});
  }, [filteredTransactions]);

  // Committed (current month + future installments still open) — matches the bank's "limite disponível" logic
  const committedByCard = useMemo(() => {
    const startKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    return expandedTransactions
      .filter((t) => {
        if (t.type !== "expense" || !t.creditCard) return false;
        const eff = (t.paymentDate || t.date).slice(0, 7);
        return eff >= startKey;
      })
      .reduce<Record<string, number>>((acc, t) => {
        const card = t.creditCard as string;
        acc[card] = (acc[card] ?? 0) + t.amount;
        return acc;
      }, {});
  }, [expandedTransactions, selectedYear, selectedMonth]);

  const cardSummary = useMemo(
    () =>
      cardNames.map((card) => {
        const spent = spentByCard[card] ?? 0;
        const committed = committedByCard[card] ?? 0;
        const limit = cardLimitsMap[card] ?? 0;
        return { card, spent, limit, committed, remaining: limit - committed };
      }),
    [cardNames, spentByCard, committedByCard, cardLimitsMap],
  );

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const categoriesByType = useMemo(() => {
    const map: Record<string, string[]> = {};
    settings.categories.forEach((c) => {
      if (!map[c.type]) map[c.type] = [];
      map[c.type].push(c.name);
    });
    return map;
  }, [settings.categories]);
  const creditCardNames = useMemo(() => settings.creditCards.map((c) => c.name), [settings.creditCards]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Painel", icon: <LayoutDashboard size={18} /> },
    { key: "entry", label: "Lançamentos", icon: <PlusCircle size={18} /> },
    { key: "all", label: "Todas", icon: <List size={18} /> },
    { key: "cards", label: "Cartões", icon: <CreditCard size={18} /> },
    { key: "settings", label: "Ajustes", icon: <Settings size={18} /> },
  ];

  if (loading || settings.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-warm shadow-warm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-foreground/20 rounded-lg p-2">
              <DollarSign size={24} className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold font-display text-primary-foreground tracking-tight">
                Controle Financeiro
              </h1>
              <p className="text-primary-foreground/60 text-xs hidden sm:block">
                {MONTHS_FULL[selectedMonth]} de {selectedYear}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  title="Abrir Planilha"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Planilha</span>
                </a>
              )}
              <button
                onClick={() => syncToSheets(transactions)}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                title="Sincronizar com planilha"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                title="Sair"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 -mt-4">
        <div className="bg-card rounded-xl shadow-card inline-flex p-1 gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "gradient-warm text-primary-foreground shadow-warm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <MonthYearSelector
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          availableYears={availableYears}
        />

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {settings.dashboardFields
                .filter((f) => f.visible)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => {
                  const fv = getFieldValue(field);
                  return (
                    <SummaryCard
                      key={field.id}
                      title={field.label}
                      value={fmt(fv.value)}
                      icon={fieldTypeIcons[field.fieldType] ?? <DollarSign size={20} />}
                      type={fv.type as any}
                      trend={fv.trend}
                    />
                  );
                })}
            </div>
            <DashboardCharts transactions={filteredTransactions} spentByCard={spentByCard} />
          </div>
        )}

        {activeTab === "entry" && (
          <div className="space-y-6">
            <div className="max-w-2xl">
              <DataEntryForm
                onAdd={addTransaction}
                categoriesByType={categoriesByType}
                creditCardNames={creditCardNames}
                transactionTypes={settings.transactionTypes}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold font-display text-foreground">
                  Lançamentos — {MONTHS_FULL[selectedMonth]} {selectedYear}
                </h2>
                <TransactionFilters
                  filters={filters}
                  onChange={setFilters}
                  categories={allCategoryNames}
                  paymentMethods={creditCardNames}
                />
              </div>
              <TransactionTable transactions={visibleTransactions} onDelete={deleteTransaction} onEdit={setEditingId} />
            </div>
          </div>
        )}

        {activeTab === "all" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-bold font-display text-foreground">
                Todas as Transações — {MONTHS_FULL[selectedMonth]} {selectedYear}
              </h2>
              <TransactionFilters
                filters={filters}
                onChange={setFilters}
                categories={allCategoryNames}
                paymentMethods={creditCardNames}
              />
            </div>
            <TransactionTable
              transactions={visibleTransactions}
              onDelete={deleteTransaction}
              onToggleStatus={toggleStatus}
              onEdit={setEditingId}
              showStatus
            />
          </div>
        )}

        {activeTab === "cards" && (() => {
          const visibleCards = selectedCardFilter.length > 0
            ? cardSummary.filter((c) => selectedCardFilter.includes(c.card))
            : cardSummary;
          const totalSpent = visibleCards.reduce((s, c) => s + c.spent, 0);
          const totalCommitted = visibleCards.reduce((s, c) => s + c.committed, 0);
          const totalLimit = visibleCards.reduce((s, c) => s + c.limit, 0);
          const totalRemaining = totalLimit - totalCommitted;
          const toggleCard = (name: string) =>
            setSelectedCardFilter((prev) =>
              prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
            );
          return (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold font-display text-foreground">
                  Gastos por Cartão — {MONTHS_FULL[selectedMonth]} {selectedYear}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selectedCardFilter.length > 0
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Filter size={14} />
                        Filtrar cartões
                        {selectedCardFilter.length > 0 && (
                          <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4">
                            {selectedCardFilter.length}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-foreground">Cartões</div>
                        {selectedCardFilter.length > 0 && (
                          <button
                            onClick={() => setSelectedCardFilter([])}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5">
                        {cardSummary.length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhum cartão</p>
                        )}
                        {cardSummary.map((c) => (
                          <label
                            key={c.card}
                            className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/50 rounded px-1 py-0.5"
                          >
                            <Checkbox
                              checked={selectedCardFilter.includes(c.card)}
                              onCheckedChange={() => toggleCard(c.card)}
                            />
                            <span className="truncate">{c.card}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    onClick={() => setInvoiceOpen(true)}
                    className="flex items-center gap-2 gradient-warm text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold shadow-warm hover:opacity-90 transition"
                  >
                    <FileText size={16} />
                    Importar fatura (PDF)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleCards.map((item) => (
                  <div key={item.card} className="bg-card rounded-lg shadow-card p-5 border border-border">
                    <p className="text-sm font-semibold text-foreground mb-3">{item.card}</p>
                    <div className="space-y-1.5 text-sm">
                      <p className="text-muted-foreground">Gasto (mês): <span className="font-semibold text-expense">{fmt(item.spent)}</span></p>
                      {item.committed !== item.spent && (
                        <p className="text-muted-foreground">Comprometido (futuro): <span className="font-semibold text-expense">{fmt(item.committed)}</span></p>
                      )}
                      <p className="text-muted-foreground">Limite: <span className="font-semibold text-foreground">{fmt(item.limit)}</span></p>
                      <p className="text-muted-foreground">Restante: <span className={`font-semibold ${item.remaining >= 0 ? "text-income" : "text-expense"}`}>{fmt(item.remaining)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
              {visibleCards.length > 0 && (
                <div className="bg-card rounded-lg shadow-card p-5 border-2 border-primary/30">
                  <p className="text-sm font-bold text-foreground mb-3">
                    Total {selectedCardFilter.length > 0 ? `(${visibleCards.length} cartão(ões) selecionado(s))` : "(todos os cartões)"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <p className="text-muted-foreground">Gasto (mês): <span className="font-bold text-expense">{fmt(totalSpent)}</span></p>
                    {totalCommitted !== totalSpent && (
                      <p className="text-muted-foreground">Comprometido (futuro): <span className="font-bold text-expense">{fmt(totalCommitted)}</span></p>
                    )}
                    <p className="text-muted-foreground">Limite: <span className="font-bold text-foreground">{fmt(totalLimit)}</span></p>
                    <p className="text-muted-foreground">Restante: <span className={`font-bold ${totalRemaining >= 0 ? "text-income" : "text-expense"}`}>{fmt(totalRemaining)}</span></p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "settings" && (
          <SettingsTab
            categories={settings.categories}
            creditCards={settings.creditCards}
            dashboardFields={settings.dashboardFields}
            onAddCategory={settings.addCategory}
            onDeleteCategory={settings.deleteCategory}
            onAddCard={settings.addCard}
            onDeleteCard={settings.deleteCard}
            onUpdateCardLimit={settings.updateCardLimit}
            onUpdateCardName={settings.updateCardName}
            onUpdateCategoryName={settings.updateCategoryName}
            onAddDashboardField={settings.addDashboardField}
            onDeleteDashboardField={settings.deleteDashboardField}
            onToggleFieldVisibility={settings.toggleFieldVisibility}
            onUpdateDashboardField={settings.updateDashboardField}
            onReorderDashboardFields={settings.reorderDashboardFields}
          />
        )}
      </main>

      <EditTransactionDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onClose={() => setEditingId(null)}
        onSave={updateTransaction}
        onCreateRecurring={(base, months) => {
          const addMonths = (dateStr: string, n: number) => {
            const [y, m, d] = dateStr.split("-").map(Number);
            const total = y * 12 + (m - 1) + n;
            const ny = Math.floor(total / 12);
            const nm = (total % 12) + 1;
            const last = new Date(ny, nm, 0).getDate();
            const nd = Math.min(d, last);
            return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
          };
          for (let i = 1; i <= months; i++) {
            addTransaction({
              ...base,
              date: addMonths(base.date, i),
              paymentDate: base.paymentDate ? addMonths(base.paymentDate, i) : undefined,
              description: `${base.description} (+${i})`,
            });
          }
        }}
        categoriesByType={categoriesByType}
        creditCardNames={creditCardNames}
        transactionTypes={settings.transactionTypes}
      />

      <InvoiceImportDialog
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        creditCardNames={creditCardNames}
        categories={allCategoryNames}
        existingTransactions={transactions}
        onImport={async (items) => {
          for (const it of items) await addTransaction(it);
        }}
      />
    </div>
  );
};

export default Index;
