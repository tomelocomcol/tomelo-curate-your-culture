
-- Enums
CREATE TYPE public.post_kind AS ENUM ('libro', 'cine', 'arte');
CREATE TYPE public.book_status AS ENUM ('leyendo', 'leido', 'pendiente');
CREATE TYPE public.film_status AS ENUM ('viendo', 'visto', 'pendiente');

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.tomelo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- Auto-create profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_tomelo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), '[^a-z0-9_]', '', 'g'));
  IF length(base_username) < 3 THEN base_username := 'lector' || substr(NEW.id::text, 1, 6); END IF;
  IF length(base_username) > 24 THEN base_username := substr(base_username, 1, 24); END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := substr(base_username, 1, 20) || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, final_username, coalesce(NEW.raw_user_meta_data->>'display_name', final_username));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_tomelo
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tomelo();

-- =========================
-- posts
-- =========================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.post_kind NOT NULL DEFAULT 'libro',
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  place TEXT,
  tagged_people TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_author_idx ON public.posts(author_id, created_at DESC);
CREATE INDEX posts_created_idx ON public.posts(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_auth" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- =========================
-- comments
-- =========================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments(post_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_auth" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- =========================
-- reactions
-- =========================
CREATE TABLE public.reactions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);
CREATE INDEX reactions_post_idx ON public.reactions(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_auth" ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert_own" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- user_books
-- =========================
CREATE TABLE public.user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  openlibrary_key TEXT,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  status public.book_status NOT NULL DEFAULT 'pendiente',
  started_at DATE,
  finished_at DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_books_user_idx ON public.user_books(user_id, status, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_books TO authenticated;
GRANT ALL ON public.user_books TO service_role;
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_books_select_auth" ON public.user_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_books_insert_own" ON public.user_books FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_books_update_own" ON public.user_books FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_books_delete_own" ON public.user_books FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_books_touch BEFORE UPDATE ON public.user_books FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- =========================
-- user_films
-- =========================
CREATE TABLE public.user_films (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  director TEXT,
  year INT,
  poster_url TEXT,
  status public.film_status NOT NULL DEFAULT 'pendiente',
  watched_at DATE,
  notes TEXT DEFAULT '',
  rating INT CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_films_user_idx ON public.user_films(user_id, status, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_films TO authenticated;
GRANT ALL ON public.user_films TO service_role;
ALTER TABLE public.user_films ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_films_select_auth" ON public.user_films FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_films_insert_own" ON public.user_films FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_films_update_own" ON public.user_films FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_films_delete_own" ON public.user_films FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_films_touch BEFORE UPDATE ON public.user_films FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();
