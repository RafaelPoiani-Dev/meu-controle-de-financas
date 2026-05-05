import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/components/DataEntryForm";
import { toast } from "sonner";

export function useGoogleSheetsSync() {
  const [syncing, setSyncing] = useState(false);

  const syncToSheets = useCallback(async (transactions: Transaction[]) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheets", {
        body: { transactions },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Sync failed");

      toast.success("Planilha sincronizada com sucesso!");
    } catch (err: unknown) {
      console.error("Google Sheets sync error:", err);
      toast.error("Erro ao sincronizar com Google Sheets");
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncToSheets, syncing };
}
