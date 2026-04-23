
CREATE TABLE public.user_cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, cost_center_id)
);

ALTER TABLE public.user_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can manage user_cost_centers"
  ON public.user_cost_centers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Users can view own cost center permissions"
  ON public.user_cost_centers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
