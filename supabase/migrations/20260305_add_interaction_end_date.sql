-- Add optional end_date for multi-day weaves
ALTER TABLE public.interactions
ADD COLUMN IF NOT EXISTS end_date bigint;

CREATE INDEX IF NOT EXISTS idx_interactions_end_date
ON public.interactions(user_id, end_date)
WHERE end_date IS NOT NULL;
