import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, nowIso, type LocalCard, type LocalCategory, type LocalDashboardField } from "@/lib/db";
import { localDelete, localUpsert } from "@/lib/sync";
import { toast } from "sonner";

export interface UserCategory {
  id: string;
  name: string;
  type: string;
}

export const defaultTransactionTypes = [
  { value: "income", label: "Receita", color: "text-income" },
  { value: "expense", label: "Despesa", color: "text-expense" },
];

export interface UserCreditCard {
  id: string;
  name: string;
  cardLimit: number;
}

export interface UserDashboardField {
  id: string;
  label: string;
  fieldType: string;
  visible: boolean;
  sortOrder: number;
  category?: string;
}

const defaultCategories: { name: string; type: "income" | "expense" }[] = [
  { name: "Salário", type: "income" },
  { name: "Freelance", type: "income" },
  { name: "Investimentos", type: "income" },
  { name: "Vendas", type: "income" },
  { name: "Outros", type: "income" },
  { name: "Alimentação", type: "expense" },
  { name: "Moradia", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Saúde", type: "expense" },
  { name: "Educação", type: "expense" },
  { name: "Lazer", type: "expense" },
  { name: "Vestuário", type: "expense" },
  { name: "Compras Parceladas", type: "expense" },
  { name: "Outros", type: "expense" },
];

const defaultCards = [
  { name: "Nubank", cardLimit: 2500 },
  { name: "Inter", cardLimit: 2000 },
  { name: "C6 Bank", cardLimit: 1500 },
  { name: "Itaú", cardLimit: 3000 },
  { name: "Bradesco", cardLimit: 3000 },
  { name: "Santander", cardLimit: 2500 },
  { name: "BTG", cardLimit: 3500 },
  { name: "Outro", cardLimit: 1000 },
];

const defaultDashboardFields = [
  { label: "Receitas", fieldType: "income", sortOrder: 0 },
  { label: "Despesas", fieldType: "expense", sortOrder: 1 },
  { label: "Saldo", fieldType: "balance", sortOrder: 2 },
];

function stripFlags<T extends Record<string, any>>(row: T) {
  const { _deleted, _dirty, ...rest } = row as any;
  return rest;
}

export function useUserSettings(userId: string | undefined) {
  const catRows = useLiveQuery(
    async () => userId ? (await db.user_categories.where("user_id").equals(userId).toArray()).filter(r => !r._deleted) : [],
    [userId],
    [] as LocalCategory[],
  );
  const cardRows = useLiveQuery(
    async () => userId ? (await db.user_credit_cards.where("user_id").equals(userId).toArray()).filter(r => !r._deleted) : [],
    [userId],
    [] as LocalCard[],
  );
  const fieldRows = useLiveQuery(
    async () => userId ? (await db.user_dashboard_fields.where("user_id").equals(userId).toArray()).filter(r => !r._deleted).sort((a, b) => a.sort_order - b.sort_order) : [],
    [userId],
    [] as LocalDashboardField[],
  );

  const categories: UserCategory[] = useMemo(
    () => (catRows ?? []).map((r) => ({ id: r.id, name: r.name, type: r.type })),
    [catRows],
  );
  const creditCards: UserCreditCard[] = useMemo(
    () => (cardRows ?? []).map((r) => ({ id: r.id, name: r.name, cardLimit: Number(r.card_limit) })),
    [cardRows],
  );
  const dashboardFields: UserDashboardField[] = useMemo(
    () => (fieldRows ?? []).map((r) => ({
      id: r.id, label: r.label, fieldType: r.field_type, visible: r.visible,
      sortOrder: r.sort_order, category: r.category ?? undefined,
    })),
    [fieldRows],
  );

  const loading = catRows === undefined || cardRows === undefined || fieldRows === undefined;

  // Seed defaults once per user (after the first sync pull empties out)
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!userId || loading || seeded) return;
    const seedKey = `seeded:${userId}`;
    (async () => {
      const flag = await db.meta.get(seedKey);
      if (flag) { setSeeded(true); return; }
      // Wait one tick for any initial pull to populate before seeding to avoid duplicates.
      // We seed only if BOTH local cache is empty AND no server data has been pulled yet.
      const lastSync = await db.meta.get(`lastSync:user_categories:${userId}`);
      if (lastSync && !categories.length) {
        // server is empty too — safe to seed
      } else if (!lastSync && (!navigator.onLine)) {
        // offline first run, seed locally; will push when online
      } else if (categories.length || creditCards.length || dashboardFields.length) {
        await db.meta.put({ key: seedKey, value: true });
        setSeeded(true);
        return;
      } else if (!lastSync) {
        // wait for pull
        return;
      }

      const now = nowIso();
      if (!categories.length) {
        for (const c of defaultCategories) {
          await localUpsert("user_categories", { id: newId(), user_id: userId, name: c.name, type: c.type, created_at: now, updated_at: now });
        }
      }
      if (!creditCards.length) {
        for (const c of defaultCards) {
          await localUpsert("user_credit_cards", { id: newId(), user_id: userId, name: c.name, card_limit: c.cardLimit, created_at: now, updated_at: now });
        }
      }
      if (!dashboardFields.length) {
        for (const f of defaultDashboardFields) {
          await localUpsert("user_dashboard_fields", { id: newId(), user_id: userId, label: f.label, field_type: f.fieldType, visible: true, sort_order: f.sortOrder, category: null, created_at: now, updated_at: now });
        }
      }
      await db.meta.put({ key: seedKey, value: true });
      setSeeded(true);
    })();
  }, [userId, loading, seeded, categories.length, creditCards.length, dashboardFields.length]);

  const transactionTypes = useMemo(() => {
    const typeSet = new Set<string>();
    defaultTransactionTypes.forEach((t) => typeSet.add(t.value));
    categories.forEach((c) => typeSet.add(c.type));
    return Array.from(typeSet);
  }, [categories]);

  // Categories
  const addCategory = useCallback(async (name: string, type: string) => {
    if (!userId) return;
    const now = nowIso();
    await localUpsert("user_categories", { id: newId(), user_id: userId, name, type, created_at: now, updated_at: now });
    toast.success("Categoria adicionada");
  }, [userId]);

  const deleteCategory = useCallback(async (id: string) => {
    await localDelete("user_categories", id);
  }, []);

  const updateCategoryName = useCallback(async (id: string, name: string) => {
    const row = await db.user_categories.get(id);
    if (!row) return;
    await localUpsert("user_categories", { ...stripFlags(row), name, updated_at: nowIso() });
    toast.success("Categoria renomeada");
  }, []);

  // Cards
  const addCard = useCallback(async (name: string, cardLimit: number) => {
    if (!userId) return;
    const now = nowIso();
    await localUpsert("user_credit_cards", { id: newId(), user_id: userId, name, card_limit: cardLimit, created_at: now, updated_at: now });
    toast.success("Cartão adicionado");
  }, [userId]);

  const deleteCard = useCallback(async (id: string) => {
    await localDelete("user_credit_cards", id);
  }, []);

  const updateCardLimit = useCallback(async (id: string, cardLimit: number) => {
    const row = await db.user_credit_cards.get(id);
    if (!row) return;
    await localUpsert("user_credit_cards", { ...stripFlags(row), card_limit: cardLimit, updated_at: nowIso() });
  }, []);

  const updateCardName = useCallback(async (id: string, name: string) => {
    const row = await db.user_credit_cards.get(id);
    if (!row) return;
    await localUpsert("user_credit_cards", { ...stripFlags(row), name, updated_at: nowIso() });
    toast.success("Cartão renomeado");
  }, []);

  // Dashboard fields
  const addDashboardField = useCallback(async (label: string, fieldType: string, category?: string) => {
    if (!userId) return;
    const now = nowIso();
    await localUpsert("user_dashboard_fields", { id: newId(), user_id: userId, label, field_type: fieldType, visible: true, sort_order: dashboardFields.length, category: category ?? null, created_at: now, updated_at: now });
    toast.success("Campo adicionado");
  }, [userId, dashboardFields.length]);

  const deleteDashboardField = useCallback(async (id: string) => {
    await localDelete("user_dashboard_fields", id);
  }, []);

  const toggleFieldVisibility = useCallback(async (id: string) => {
    const row = await db.user_dashboard_fields.get(id);
    if (!row) return;
    await localUpsert("user_dashboard_fields", { ...stripFlags(row), visible: !row.visible, updated_at: nowIso() });
  }, []);

  const updateDashboardField = useCallback(async (id: string, label: string, fieldType: string, category?: string) => {
    const row = await db.user_dashboard_fields.get(id);
    if (!row) return;
    await localUpsert("user_dashboard_fields", { ...stripFlags(row), label, field_type: fieldType, category: category ?? null, updated_at: nowIso() });
  }, []);

  const reorderDashboardFields = useCallback(async (orderedIds: string[]) => {
    const now = nowIso();
    for (let idx = 0; idx < orderedIds.length; idx++) {
      const id = orderedIds[idx];
      const row = await db.user_dashboard_fields.get(id);
      if (!row) continue;
      await localUpsert("user_dashboard_fields", { ...stripFlags(row), sort_order: idx, updated_at: now });
    }
  }, []);

  return {
    categories, creditCards, dashboardFields, loading, transactionTypes,
    addCategory, deleteCategory, updateCategoryName,
    addCard, deleteCard, updateCardLimit, updateCardName,
    addDashboardField, deleteDashboardField, toggleFieldVisibility, updateDashboardField, reorderDashboardFields,
  };
}
