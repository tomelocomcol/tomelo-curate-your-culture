ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS place text,
  ADD COLUMN IF NOT EXISTS place_lat double precision,
  ADD COLUMN IF NOT EXISTS place_lng double precision,
  ADD COLUMN IF NOT EXISTS tagged_people text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_author_id_fkey;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;