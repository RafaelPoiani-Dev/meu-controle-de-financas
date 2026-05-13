import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { isSyncing, onSyncChange, syncAll } from "@/lib/sync";
import { useOnlineStatus } from "./useOnlineStatus";

export function useSyncStatus(userId: string | undefined) {
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(isSyncing());

  useEffect(() => {
    const off = onSyncChange(() => setSyncing(isSyncing()));
    return () => { off(); };
  }, []);

  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0);

  const triggerSync = () => {
    if (userId) void syncAll(userId);
  };

  return { online, syncing, pendingCount: pendingCount ?? 0, triggerSync };
}
