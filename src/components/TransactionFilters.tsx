import { Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export interface FilterState {
  categories: string[];
  paymentMethods: string[];
  dateFrom: string;
  dateTo: string;
}

export const emptyFilters: FilterState = {
  categories: [],
  paymentMethods: [],
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
    filters.categories.length +
    filters.paymentMethods.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);
  const hasActive = activeCount > 0;

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

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

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Categorias {filters.categories.length > 0 && `(${filters.categories.length})`}
            </label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-input bg-background p-2 space-y-1.5">
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma categoria disponível</p>
              )}
              {categories.map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox
                    checked={filters.categories.includes(c)}
                    onCheckedChange={() => update({ categories: toggleIn(filters.categories, c) })}
                  />
                  <span className="truncate">{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Meios de pagamento {filters.paymentMethods.length > 0 && `(${filters.paymentMethods.length})`}
            </label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-input bg-background p-2 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/50 rounded px-1 py-0.5">
                <Checkbox
                  checked={filters.paymentMethods.includes("__cash__")}
                  onCheckedChange={() => update({ paymentMethods: toggleIn(filters.paymentMethods, "__cash__") })}
                />
                <span>Dinheiro / Débito</span>
              </label>
              {paymentMethods.map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/50 rounded px-1 py-0.5">
                  <Checkbox
                    checked={filters.paymentMethods.includes(c)}
                    onCheckedChange={() => update({ paymentMethods: toggleIn(filters.paymentMethods, c) })}
                  />
                  <span className="truncate">{c}</span>
                </label>
              ))}
            </div>
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
