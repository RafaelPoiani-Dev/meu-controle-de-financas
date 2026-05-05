import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/components/DataEntryForm";
import { toast } from "sonner";

export function useTransactions(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      toast.error("Erro ao carregar transações");
    } else {
      setTransactions(
        (data ?? []).map((r: any) => ({
          id: r.id,
          date: r.date,
          paymentDate: r.payment_date ?? undefined,
          description: r.description,
          category: r.category,
          type: r.type as "income" | "expense",
          amount: Number(r.amount),
          installments: r.installments ?? undefined,
          currentInstallment: r.current_installment ?? undefined,
          creditCard: r.credit_card ?? undefined,
          status: (r.status as "pending" | "paid") ?? "pending",
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(
    async (t: Omit<Transaction, "id">) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          date: t.date,
          payment_date: t.paymentDate ?? null,
          description: t.description,
          category: t.category,
          type: t.type,
          amount: t.amount,
          installments: t.installments ?? null,
          current_installment: t.currentInstallment ?? null,
          credit_card: t.creditCard ?? null,
          status: t.status ?? "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        toast.error("Erro ao salvar transação");
      } else if (data) {
        setTransactions((prev) => [
          {
            id: data.id,
            date: data.date,
            paymentDate: data.payment_date ?? undefined,
            description: data.description,
            category: data.category,
            type: data.type as "income" | "expense",
            amount: Number(data.amount),
            installments: data.installments ?? undefined,
            currentInstallment: data.current_installment ?? undefined,
            creditCard: data.credit_card ?? undefined,
            status: (data.status as "pending" | "paid") ?? "pending",
          },
          ...prev,
        ]);
        toast.success("Transação salva!");
      }
    },
    [userId]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) {
        console.error("Delete error:", error);
        toast.error("Erro ao excluir transação");
      } else {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
    },
    []
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      const transaction = transactions.find((t) => t.id === id);
      if (!transaction) return;
      const newStatus = transaction.status === "paid" ? "pending" : "paid";
      const { error } = await supabase
        .from("transactions")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) {
        console.error("Update error:", error);
        toast.error("Erro ao atualizar status");
      } else {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );
      }
    },
    [transactions]
  );

  const updateTransaction = useCallback(
    async (id: string, t: Partial<Omit<Transaction, "id">>) => {
      const payload: Record<string, any> = {};
      if (t.date !== undefined) payload.date = t.date;
      if (t.paymentDate !== undefined) payload.payment_date = t.paymentDate || null;
      if (t.description !== undefined) payload.description = t.description;
      if (t.category !== undefined) payload.category = t.category;
      if (t.type !== undefined) payload.type = t.type;
      if (t.amount !== undefined) payload.amount = t.amount;
      if (t.creditCard !== undefined) payload.credit_card = t.creditCard || null;
      if (t.status !== undefined) payload.status = t.status;

      const { error } = await supabase.from("transactions").update(payload).eq("id", id);
      if (error) {
        console.error("Update error:", error);
        toast.error("Erro ao atualizar transação");
      } else {
        setTransactions((prev) =>
          prev.map((tr) => (tr.id === id ? { ...tr, ...t } : tr))
        );
        toast.success("Transação atualizada!");
      }
    },
    []
  );

  return { transactions, loading, addTransaction, deleteTransaction, toggleStatus, updateTransaction };
}
