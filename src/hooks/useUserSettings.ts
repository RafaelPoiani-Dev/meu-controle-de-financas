import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export function useUserSettings(userId: string | undefined) {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [creditCards, setCreditCards] = useState<UserCreditCard[]>([]);
  const [dashboardFields, setDashboardFields] = useState<UserDashboardField[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [catRes, cardRes, fieldRes] = await Promise.all([
      supabase.from("user_categories").select("*").order("created_at"),
      supabase.from("user_credit_cards").select("*").order("created_at"),
      supabase.from("user_dashboard_fields").select("*").order("sort_order"),
    ]);

    // Seed defaults if empty
    if (!catRes.data?.length) {
      const { data } = await supabase
        .from("user_categories")
        .insert(defaultCategories.map((c) => ({ ...c, user_id: userId })))
        .select();
      setCategories((data ?? []).map((r: any) => ({ id: r.id, name: r.name, type: r.type })));
    } else {
      setCategories(catRes.data.map((r: any) => ({ id: r.id, name: r.name, type: r.type })));
    }

    if (!cardRes.data?.length) {
      const { data } = await supabase
        .from("user_credit_cards")
        .insert(defaultCards.map((c) => ({ name: c.name, card_limit: c.cardLimit, user_id: userId })))
        .select();
      setCreditCards((data ?? []).map((r: any) => ({ id: r.id, name: r.name, cardLimit: Number(r.card_limit) })));
    } else {
      setCreditCards(cardRes.data.map((r: any) => ({ id: r.id, name: r.name, cardLimit: Number(r.card_limit) })));
    }

    if (!fieldRes.data?.length) {
      const { data } = await supabase
        .from("user_dashboard_fields")
        .insert(defaultDashboardFields.map((f) => ({ ...f, field_type: f.fieldType, user_id: userId })))
        .select();
      setDashboardFields(
        (data ?? []).map((r: any) => ({
          id: r.id, label: r.label, fieldType: r.field_type, visible: r.visible, sortOrder: r.sort_order, category: r.category ?? undefined,
        }))
      );
    } else {
      setDashboardFields(
        fieldRes.data.map((r: any) => ({
          id: r.id, label: r.label, fieldType: r.field_type, visible: r.visible, sortOrder: r.sort_order, category: r.category ?? undefined,
        }))
      );
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Categories
  // Distinct transaction types from categories
  const transactionTypes = useMemo(() => {
    const typeSet = new Set<string>();
    defaultTransactionTypes.forEach((t) => typeSet.add(t.value));
    categories.forEach((c) => typeSet.add(c.type));
    return Array.from(typeSet);
  }, [categories]);

  const addCategory = useCallback(async (name: string, type: string) => {
    if (!userId) return;
    const { data, error } = await supabase.from("user_categories").insert({ user_id: userId, name, type }).select().single();
    if (error) { toast.error("Erro ao adicionar categoria"); return; }
    setCategories((prev) => [...prev, { id: data.id, name: data.name, type: data.type as "income" | "expense" }]);
    toast.success("Categoria adicionada");
  }, [userId]);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_categories").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover categoria"); return; }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCategoryName = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("user_categories").update({ name }).eq("id", id);
    if (error) { toast.error("Erro ao renomear categoria"); return; }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    toast.success("Categoria renomeada");
  }, []);

  // Cards
  const addCard = useCallback(async (name: string, cardLimit: number) => {
    if (!userId) return;
    const { data, error } = await supabase.from("user_credit_cards").insert({ user_id: userId, name, card_limit: cardLimit }).select().single();
    if (error) { toast.error("Erro ao adicionar cartão"); return; }
    setCreditCards((prev) => [...prev, { id: data.id, name: data.name, cardLimit: Number(data.card_limit) }]);
    toast.success("Cartão adicionado");
  }, [userId]);

  const deleteCard = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_credit_cards").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover cartão"); return; }
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCardLimit = useCallback(async (id: string, cardLimit: number) => {
    const { error } = await supabase.from("user_credit_cards").update({ card_limit: cardLimit }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar limite"); return; }
    setCreditCards((prev) => prev.map((c) => (c.id === id ? { ...c, cardLimit } : c)));
  }, []);

  const updateCardName = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("user_credit_cards").update({ name }).eq("id", id);
    if (error) { toast.error("Erro ao renomear cartão"); return; }
    setCreditCards((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    toast.success("Cartão renomeado");
  }, []);

  // Dashboard fields
  const addDashboardField = useCallback(async (label: string, fieldType: string, category?: string) => {
    if (!userId) return;
    const order = dashboardFields.length;
    const insertData: any = { user_id: userId, label, field_type: fieldType, sort_order: order };
    if (category) insertData.category = category;
    const { data, error } = await supabase.from("user_dashboard_fields").insert(insertData).select().single();
    if (error) { toast.error("Erro ao adicionar campo"); return; }
    setDashboardFields((prev) => [...prev, { id: data.id, label: data.label, fieldType: data.field_type, visible: data.visible, sortOrder: data.sort_order, category: data.category ?? undefined }]);
    toast.success("Campo adicionado");
  }, [userId, dashboardFields]);

  const deleteDashboardField = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_dashboard_fields").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover campo"); return; }
    setDashboardFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const toggleFieldVisibility = useCallback(async (id: string) => {
    const field = dashboardFields.find((f) => f.id === id);
    if (!field) return;
    const { error } = await supabase.from("user_dashboard_fields").update({ visible: !field.visible }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar campo"); return; }
    setDashboardFields((prev) => prev.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)));
  }, [dashboardFields]);

  const updateDashboardField = useCallback(async (id: string, label: string, fieldType: string, category?: string) => {
    const updateData: any = { label, field_type: fieldType, category: category || null };
    const { error } = await supabase.from("user_dashboard_fields").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar campo"); return; }
    setDashboardFields((prev) => prev.map((f) => (f.id === id ? { ...f, label, fieldType, category: category || undefined } : f)));
  }, []);

  const reorderDashboardFields = useCallback(async (orderedIds: string[]) => {
    setDashboardFields((prev) => {
      const map = new Map(prev.map((f) => [f.id, f]));
      return orderedIds
        .map((id, idx) => {
          const f = map.get(id);
          return f ? { ...f, sortOrder: idx } : null;
        })
        .filter(Boolean) as UserDashboardField[];
    });
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from("user_dashboard_fields").update({ sort_order: idx }).eq("id", id)
      )
    );
  }, []);

  return {
    categories, creditCards, dashboardFields, loading: loading, transactionTypes,
    addCategory, deleteCategory, updateCategoryName,
    addCard, deleteCard, updateCardLimit, updateCardName,
    addDashboardField, deleteDashboardField, toggleFieldVisibility, updateDashboardField, reorderDashboardFields,
  };
}
