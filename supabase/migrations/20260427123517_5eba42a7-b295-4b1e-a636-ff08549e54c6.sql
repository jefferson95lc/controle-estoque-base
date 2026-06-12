ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_client_request_id
  ON public.stock_movements(client_request_id)
  WHERE client_request_id IS NOT NULL;
