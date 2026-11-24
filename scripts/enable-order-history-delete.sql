-- Execute no mesmo banco externo de produção onde o histórico foi ativado.
-- Adiciona apenas permissão de exclusão individual para Master.
BEGIN;
GRANT DELETE ON public.order_history TO authenticated;
DROP POLICY IF EXISTS order_history_delete_master ON public.order_history;
CREATE POLICY order_history_delete_master
ON public.order_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'master'::public.app_role));
COMMIT;