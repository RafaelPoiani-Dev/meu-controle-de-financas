import Dexie, { type Table } from "dexie";

// Local mirror of the Supabase rows (snake_case to match server payloads).
// `_deleted` = 1 marks a tombstone (hidden from UI, awaiting server delete).
// `_dirty`   = 1 marks a row that has pending local changes not yet pushed.
export interface LocalTransaction {
  id: string;
  user_id: string;
  date: string;
  payment_date: string | null;
  description: string;
  category: string;
  type: string;
  amount: number;
  installments: number | null;
  current_installment: number | null;
  credit_card: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  _deleted?: number;
  _dirty?: number;
}

export interface LocalCard {
  id: string;
  user_id: string;
  name: string;
  card_limit: number;
  created_at: string;
  updated_at: string;
  _deleted?: number;
  _dirty?: number;
}

export interface LocalCategory {
  id: string;
  user_id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  _deleted?: number;
  _dirty?: number;
}

export interface LocalDashboardField {
  id: string;
  user_id: string;
  label: string;
  field_type: string;
  visible: boolean;
  sort_order: number;
  category: string | null;
  created_at: string;
  updated_at: string;
  _deleted?: number;
  _dirty?: number;
}

export type SyncTable =
  | "transactions"
  | "user_credit_cards"
  | "user_categories"
  | "user_dashboard_fields";

export interface OutboxEntry {
  id?: number;
  table: SyncTable;
  op: "upsert" | "delete";
  rowId: string;
  payload?: any;
  enqueuedAt: string;
}

export interface MetaEntry {
  key: string;
  value: any;
}

class AppDB extends Dexie {
  transactions!: Table<LocalTransaction, string>;
  user_credit_cards!: Table<LocalCard, string>;
  user_categories!: Table<LocalCategory, string>;
  user_dashboard_fields!: Table<LocalDashboardField, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("finance-offline-v1");
    this.version(1).stores({
      transactions: "id, user_id, updated_at, _deleted, _dirty",
      user_credit_cards: "id, user_id, updated_at, _deleted, _dirty",
      user_categories: "id, user_id, updated_at, _deleted, _dirty",
      user_dashboard_fields: "id, user_id, updated_at, _deleted, _dirty, sort_order",
      outbox: "++id, table, rowId, enqueuedAt",
      meta: "key",
    });
  }
}

export const db = new AppDB();

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
