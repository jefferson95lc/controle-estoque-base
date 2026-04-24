CREATE TABLE public.product_min_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  cost_center_id UUID NOT NULL,
  min_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, cost_center_id)
);

ALTER TABLE public.product_min_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_min_stock"
ON public.product_min_stock FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert product_min_stock"
ON public.product_min_stock FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update product_min_stock"
ON public.product_min_stock FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete product_min_stock"
ON public.product_min_stock FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_product_min_stock_updated_at
BEFORE UPDATE ON public.product_min_stock
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_product_min_stock_product ON public.product_min_stock(product_id);
CREATE INDEX idx_product_min_stock_center ON public.product_min_stock(cost_center_id);