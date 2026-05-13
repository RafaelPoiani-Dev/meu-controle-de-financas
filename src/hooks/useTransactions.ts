import { useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Transaction } from "@/components/DataEntryForm";
import { db, newId, nowIso, type LocalTransaction } from "@/lib/db";
import { localDelete, localUpsert, startAutoSync } from "@/lib/sync";
import { toast } from "sonner";

function rowToTransaction(r: LocalTransaction): Transaction {
  return {
    id: r.id,
    date: r.date,
    paymentDate: r.payment_date ?? undefined,
    description: r.description,
    category: r.category,
    type: r.type,
    amount: Number(r.amount),
    installments: r.installments ?? undefined,
    currentInstallment: r.current_installment ?? undefined,
    creditCard: r.credit_card ?? undefined,
    status: (r.status as "pending" | "paid") ?? "pending",
  };
}

export function useTransactions(userId: string | undefined) {
  // Start the background sync engine for this user
  useEffect(() => {
    if (!userId) return;
    return startAutoSync(userId);
  }, [userId]);

  const rows = useLiveQuery(
    async () => {
      if (!userId) return [] as LocalTransaction[];
      const all = await db.transactions.where("user_id").equals(userId).toArray();
      return all
        .filter((r) => !r._deleted)
        .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    },
    [userId],
    [] as LocalTransaction[],
  );

  const transactions: Transaction[] = (rows ?? []).map(rowToTransaction);
  const loading = rows === undefined;

  const addTransaction = useCallback(
    async (t: Omit<Transaction, "id">) => {
      if (!userId) return;
      const now = nowIso();
      const row: LocalTransaction = {
        id: newId(),
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
        created_at: now,
        updated_at: now,
      };
      const { _deleted, _dirty, ...payload } = row;
      await localUpsert("transactions", payload);
      toast.success("Transação salva!");
    },
    [userId],
  );

  const deleteTransaction = useCallback(async (id: string) => {
    await localDelete("transactions", id);
  }, []);

  const toggleStatus = useCallback(
    async (id: string) => {
      const row = await db.transactions.get(id);
      if (!row) return;
      const newStatus = row.status === "paid" ? "pending" : "paid";
      const updated = { ...row, status: newStatus, updated_at: nowIso() };
      const { _deleted, _dirty, ...payload } = updated;
      await localUpsert("transactions", payload);
    },
    [],
  );

  const updateTransaction = useCallback(
    async (id: string, t: Partial<Omit<Transaction, "id">>) => {
      const row = await db.transactions.get(id);
      if (!row) return;
      const updated: LocalTransaction = {
        ...row,
        date: t.date ?? row.date,
        payment_date: t.paymentDate !== undefined ? (t.paymentDate || null) : row.payment_date,
        description: t.description ?? row.description,
        category: t.category ?? row.category,
        type: t.type ?? row.type,
        amount: t.amount ?? row.amount,
        credit_card: t.creditCard !== undefined ? (t.creditCard || null) : row.credit_card,
        status: t.status ?? row.status,
        updated_at: nowIso(),
      };
      const { _deleted, _dirty, ...payload } = updated;
      await localUpsert("transactions", payload);
      toast.success("Transação atualizada!");
    },
    [],
  );

  return { transactions, loading, addTransaction, deleteTransaction, toggleStatus, updateTransaction };
}
