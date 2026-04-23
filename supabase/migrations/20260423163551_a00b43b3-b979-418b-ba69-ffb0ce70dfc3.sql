
ALTER TABLE public.stock_movements
ADD COLUMN user_id uuid REFERENCES auth.users(id);
