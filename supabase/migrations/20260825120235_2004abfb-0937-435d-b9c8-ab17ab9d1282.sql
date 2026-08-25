CREATE OR REPLACE FUNCTION public.enforce_non_negative_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bal integer;
BEGIN
  IF NEW.type IN ('saida', 'transferencia') THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.product_id::text || ':' || NEW.cost_center_id::text));

    SELECT COALESCE(SUM(
      CASE
        WHEN type = 'entrada' AND cost_center_id = NEW.cost_center_id THEN quantity
        WHEN type = 'saida' AND cost_center_id = NEW.cost_center_id THEN -quantity
        WHEN type = 'transferencia' AND cost_center_id = NEW.cost_center_id THEN -quantity
        WHEN type = 'transferencia' AND destination_center_id = NEW.cost_center_id THEN quantity
        ELSE 0
      END), 0)
    INTO v_bal
    FROM public.stock_movements
    WHERE product_id = NEW.product_id
      AND (cost_center_id = NEW.cost_center_id OR destination_center_id = NEW.cost_center_id)
      AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

    IF v_bal < NEW.quantity THEN
      RAISE EXCEPTION 'ESTOQUE_NEGATIVO: disponivel %, solicitado %', v_bal, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_non_negative_stock ON public.stock_movements;
CREATE TRIGGER trg_enforce_non_negative_stock
BEFORE INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.enforce_non_negative_stock();