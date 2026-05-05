
-- Add payment_date to transactions
ALTER TABLE public.transactions ADD COLUMN payment_date text;

-- User categories table
CREATE TABLE public.user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, type)
);
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.user_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.user_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.user_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.user_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User credit cards table
CREATE TABLE public.user_credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  card_limit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
ALTER TABLE public.user_credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cards" ON public.user_credit_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.user_credit_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.user_credit_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.user_credit_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User dashboard fields table
CREATE TABLE public.user_dashboard_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'balance',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);
ALTER TABLE public.user_dashboard_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own fields" ON public.user_dashboard_fields FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fields" ON public.user_dashboard_fields FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own fields" ON public.user_dashboard_fields FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own fields" ON public.user_dashboard_fields FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
