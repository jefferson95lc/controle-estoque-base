
CREATE OR REPLACE FUNCTION public.is_master_email(_email TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE
SET search_path = public
AS $$ SELECT lower(_email) = 'odontoart@odontoart.com' $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
