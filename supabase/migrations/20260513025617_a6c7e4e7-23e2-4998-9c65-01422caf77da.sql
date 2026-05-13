-- Generic updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_credit_cards
ALTER TABLE public.user_credit_cards
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_user_credit_cards_updated_at ON public.user_credit_cards;
CREATE TRIGGER trg_user_credit_cards_updated_at
BEFORE UPDATE ON public.user_credit_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_categories
ALTER TABLE public.user_categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_user_categories_updated_at ON public.user_categories;
CREATE TRIGGER trg_user_categories_updated_at
BEFORE UPDATE ON public.user_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_dashboard_fields
ALTER TABLE public.user_dashboard_fields
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_user_dashboard_fields_updated_at ON public.user_dashboard_fields;
CREATE TRIGGER trg_user_dashboard_fields_updated_at
BEFORE UPDATE ON public.user_dashboard_fields
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();