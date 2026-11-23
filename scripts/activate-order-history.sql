-- Execute somente no banco de PRODUÇÃO usado pelo aplicativo.
-- Adiciona histórico de pedidos sem alterar estoque ou tabelas existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  center_ids uuid[] NOT NULL,
  "order" jsonb NOT NULL,
  CONSTRAINT order_history_centers_not_empty CHECK (cardinality(center_ids) > 0),
  CONSTRAINT order_history_snapshot_object CHECK (jsonb_typeof("order") = 'object')
);
GRANT SELECT, INSERT ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_history_read ON public.order_history;
CREATE POLICY order_history_read ON public.order_history FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'master'::public.app_role)
  OR (
    cardinality(center_ids) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(center_ids) AS center(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_cost_centers uc
        WHERE uc.user_id = auth.uid() AND uc.cost_center_id = center.id
      )
    )
  )
);
DROP POLICY IF EXISTS order_history_insert ON public.order_history;
CREATE POLICY order_history_insert ON public.order_history FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'master'::public.app_role)
    OR (
      cardinality(center_ids) > 0 AND NOT EXISTS (
        SELECT 1 FROM unnest(center_ids) AS center(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_cost_centers uc
          WHERE uc.user_id = auth.uid() AND uc.cost_center_id = center.id
        )
      )
    )
  )
);
CREATE INDEX IF NOT EXISTS order_history_created_at_idx ON public.order_history (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS order_history_center_ids_idx ON public.order_history USING gin (center_ids);
COMMIT;