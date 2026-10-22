import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Transaction } from "@/components/DataEntryForm";

export interface Goal {
  id: string;
  name: string;
  target: number;
  deadline: string | null; // YYYY-MM-DD
  category: string;
  isMain: boolean;
}

const CACHE = "goals-cache";

const map = (r: any): Goal => ({
  id: r.id, name: r.name, target: Number(r.target), deadline: r.deadline,
  category: r.category, isMain: r.is_main,
});

export function goalYear(g: Goal, fallbackYear: number) {
  return g.deadline ? Number(g.deadline.slice(0, 4)) : fallbackYear;
}

/** Transactions in the goal category up to the goal deadline (by payment date). Accumulated, so older contributions count too. */
export function goalContributions(g: Goal, txs: Transaction[], fallbackYear: number) {
  const limit = g.deadline ?? `${goalYear(g, fallbackYear)}-12-31`;
  const cat = g.category.toLowerCase();
  return txs
    .filter((t) => t.category?.toLowerCase() === cat && (t.paymentDate || t.date) <= limit)
    .sort((a, b) => (a.paymentDate || a.date).localeCompare(b.paymentDate || b.date));
}

export function useGoals(userId?: string) {
  const [goals, setGoals] = useState<Goal[]>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE) || "[]"); } catch { return []; }
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("user_goals").select("*").eq("user_id", userId).order("created_at");
    if (error) return;
    const g = (data ?? []).map(map);
    setGoals(g);
    localStorage.setItem(CACHE, JSON.stringify(g));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = async (g: Omit<Goal, "id"> & { id?: string }) => {
    if (!userId) return;
    if (g.isMain) await supabase.from("user_goals").update({ is_main: false }).eq("user_id", userId);
    const row = { user_id: userId, name: g.name, target: g.target, deadline: g.deadline, category: g.category, is_main: g.isMain };
    const { error } = g.id
      ? await supabase.from("user_goals").update(row).eq("id", g.id)
      : await supabase.from("user_goals").insert(row);
    if (error) toast.error("Não foi possível salvar a meta");
    else toast.success("Meta salva");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("user_goals").delete().eq("id", id);
    load();
  };

  const setMain = async (id: string) => {
    if (!userId) return;
    await supabase.from("user_goals").update({ is_main: false }).eq("user_id", userId);
    await supabase.from("user_goals").update({ is_main: true }).eq("id", id);
    load();
  };

  return { goals, save, remove, setMain };
}
