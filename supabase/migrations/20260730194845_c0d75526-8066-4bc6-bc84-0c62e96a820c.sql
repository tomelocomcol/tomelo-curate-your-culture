ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS current_page integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_genres text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS favorite_cinemas text DEFAULT '',
  ADD COLUMN IF NOT EXISTS favorite_cafes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS favorite_film text DEFAULT '';