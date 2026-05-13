import { supabase } from "@/integrations/supabase/client";
import { db, type SyncTable } from "./db";

const TABLES: SyncTable[] = [
  "transactions",
  "user_credit_cards",
  "user_categories",
  "user_dashboard_fields",
];

let syncing = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();

export function isSyncing() {
  return syncing;
}
export function getLastError() {
  return lastError;
}
export function onSyncChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => l());
}

function tableOf(name: SyncTable) {
  return (db as any)[name] as ReturnType<typeof db.table>;
}

// PULL: fetch rows changed since last sync; merge respecting local dirty rows.
export async function pullAll(userId: string) {
  for (const table of TABLES) {
    const lastKey = `lastSync:${table}:${userId}`;
    const lastEntry = await db.meta.get(lastKey);
    const since = (lastEntry?.value as string | undefined) ?? null;

    let q = supabase.from(table as any).select("*").eq("user_id", userId);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) {
      console.error("[sync] pull error", table, error.message);
      lastError = error.message;
      continue;
    }
    if (!data?.length) continue;

    let maxUpdated = since ?? "";
    const tbl = tableOf(table);
    await db.transaction("rw", tbl, async () => {
      for (const remote of data as any[]) {
        if (remote.updated_at > maxUpdated) maxUpdated = remote.updated_at;
        const local = (await tbl.get(remote.id)) as any;
        // Don't overwrite rows with pending local changes — push will reconcile.
        if (local?._dirty) continue;
        await tbl.put({ ...remote, _deleted: 0, _dirty: 0 });
      }
    });
    await db.meta.put({ key: lastKey, value: maxUpdated });
  }
  notify();
}

// PUSH: drain outbox in FIFO order. Stop on first failure to preserve order.
export async function pushOutbox() {
  const entries = await db.outbox.orderBy("id").toArray();
  for (const entry of entries) {
    try {
      const tbl = tableOf(entry.table);
      if (entry.op === "upsert") {
        const { error } = await supabase.from(entry.table as any).upsert(entry.payload);
        if (error) throw error;
        const local = await tbl.get(entry.rowId);
        if (local) await tbl.update(entry.rowId, { _dirty: 0 });
      } else if (entry.op === "delete") {
        const { error } = await supabase
          .from(entry.table as any)
          .delete()
          .eq("id", entry.rowId);
        if (error) throw error;
        await tbl.delete(entry.rowId);
      }
      await db.outbox.delete(entry.id!);
      lastError = null;
    } catch (e: any) {
      console.error("[sync] push failed", entry, e);
      lastError = e?.message ?? String(e);
      break;
    }
  }
  notify();
}

export async function syncAll(userId: string) {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  notify();
  try {
    await pushOutbox();
    await pullAll(userId);
  } finally {
    syncing = false;
    notify();
  }
}

export function startAutoSync(userId: string) {
  void syncAll(userId);
  const onOnline = () => void syncAll(userId);
  const onFocus = () => void syncAll(userId);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  const interval = window.setInterval(() => void syncAll(userId), 60_000);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    window.clearInterval(interval);
  };
}

// ---------- Local mutation helpers (write to Dexie + enqueue outbox) ----------

export async function localUpsert(table: SyncTable, row: any) {
  const tbl = tableOf(table);
  await db.transaction("rw", tbl, db.outbox, async () => {
    await tbl.put({ ...row, _deleted: 0, _dirty: 1 });
    await db.outbox.add({
      table,
      op: "upsert",
      rowId: row.id,
      payload: row,
      enqueuedAt: new Date().toISOString(),
    });
  });
  notify();
}

export async function localDelete(table: SyncTable, id: string) {
  const tbl = tableOf(table);
  await db.transaction("rw", tbl, db.outbox, async () => {
    const existing = await tbl.get(id);
    if (existing) await tbl.update(id, { _deleted: 1, _dirty: 1 });
    // Collapse any pending upserts for this row
    const pending = await db.outbox.where({ table, rowId: id }).toArray();
    for (const p of pending) await db.outbox.delete(p.id!);
    await db.outbox.add({
      table,
      op: "delete",
      rowId: id,
      enqueuedAt: new Date().toISOString(),
    });
  });
  notify();
}

export async function clearUserCache(userId: string) {
  const tables = [db.transactions, db.user_credit_cards, db.user_categories, db.user_dashboard_fields, db.outbox, db.meta];
  await db.transaction("rw", tables, async () => {
    for (const t of TABLES) {
      await tableOf(t).where("user_id").equals(userId).delete();
    }
    await db.outbox.clear();
    const metas = await db.meta.toArray();
    for (const m of metas) {
      if (m.key.endsWith(`:${userId}`)) await db.meta.delete(m.key);
    }
  });
}
