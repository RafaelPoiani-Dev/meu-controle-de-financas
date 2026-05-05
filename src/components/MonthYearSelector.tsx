import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface MonthYearSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  availableYears: number[];
}

const MonthYearSelector = ({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  availableYears,
}: MonthYearSelectorProps) => {
  const monthsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (monthsRef.current) {
      const activeBtn = monthsRef.current.querySelector("[data-active='true']");
      activeBtn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedMonth]);

  return (
    <div className="bg-card rounded-lg shadow-card border border-border p-3 animate-fade-in">
      {/* Year selector */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => onYearChange(year)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                year === selectedYear
                  ? "gradient-warm text-primary-foreground shadow-warm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        <button
          onClick={() => onYearChange(selectedYear + 1)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Month selector */}
      <div
        ref={monthsRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide pb-1"
      >
        {MONTHS.map((month, index) => (
          <button
            key={month}
            data-active={index === selectedMonth}
            onClick={() => onMonthChange(index)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              index === selectedMonth
                ? "gradient-warm text-primary-foreground shadow-warm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {month}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MonthYearSelector;
