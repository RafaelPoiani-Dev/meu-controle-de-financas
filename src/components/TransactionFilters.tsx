import { Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterState {
  category: string;
  paymentMethod: string;
  dateFrom: string;
  dateTo: string;
}

export const emptyFilters: FilterState = {
  category: "",
  paymentMethod: "",
  dateFrom: "",
  dateTo: "",
};

interface TransactionFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  categories: string[];
  paymentMethods: string[];
}

const TransactionFilters = ({ filters, onChange, categories, paymentMethods }: TransactionFiltersProps) => {
  const activeCount =
    (filters.category ? 1 : 0) +
    (filters.paymentMethod ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);
  const hasActive = activeCount > 0;

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`relative flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            hasActive
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter size={14} />
          Filtros
          {hasActive && (
            <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Filter size={14} className="text-primary" />
            Filtros
          </div>
          {hasActive && (
            <button
              onClick={() => onChange(emptyFilters)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
              Limpar
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Categoria</label>
            <select
              value={filters.category}
              onChange={(e) => update({ category: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Meio de pagamento</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => update({ paymentMethod: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              <option value="__cash__">Dinheiro / Débito</option>
              {paymentMethods.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">De</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update({ dateFrom: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Até</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update({ dateTo: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TransactionFilters;
