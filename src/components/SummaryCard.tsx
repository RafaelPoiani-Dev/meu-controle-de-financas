import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  type?: "income" | "expense" | "balance" | "savings";
}

const SummaryCard = ({ title, value, icon, trend, type = "balance" }: SummaryCardProps) => {
  const typeStyles = {
    income: "border-l-4 border-l-income",
    expense: "border-l-4 border-l-expense",
    balance: "border-l-4 border-l-primary",
    savings: "border-l-4 border-l-secondary",
  };

  return (
    <div className={`bg-card rounded-lg p-5 shadow-card animate-fade-in ${typeStyles[type]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-bold font-display text-card-foreground">{value}</p>
      {trend && (
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      )}
    </div>
  );
};

export default SummaryCard;
