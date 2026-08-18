-- Enums
DO $$ BEGIN CREATE TYPE public.post_kind AS ENUM ('libro','cine','arte'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.book_status AS ENUM ('leyendo','leido','pendiente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.film_status AS ENUM ('viendo','visto','pendiente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.friendship_status AS ENUM ('pendiente','aceptada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.tomelo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  favorite_genres text[] NOT NULL DEFAULT '{}'::text[],
  favorite_cinemas text DEFAULT '',
  favorite_cafes text DEFAULT '',
  favorite_film text DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all_auth" ON public.profiles;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

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
DROP TRIGGER IF EXISTS on_auth_user_created_tomelo ON auth.users;
CREATE TRIGGER on_auth_user_created_tomelo AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tomelo();

-- backfill profiles for existing auth users
INSERT INTO public.profiles (id, username, display_name)
SELECT u.id,
       'lector' || substr(u.id::text,1,6),
       coalesce(u.raw_user_meta_data->>'display_name', 'lector' || substr(u.id::text,1,6))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.post_kind NOT NULL DEFAULT 'libro',
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  place TEXT,
  place_lat double precision,
  place_lng double precision,
  tagged_people TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS place_lat double precision;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS place_lng double precision;
CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select_auth" ON public.posts;
CREATE POLICY "posts_select_auth" ON public.posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
DROP TRIGGER IF EXISTS posts_touch ON public.posts;
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- comments
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments(post_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select_auth" ON public.comments;
CREATE POLICY "comments_select_auth" ON public.comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- reactions
CREATE TABLE IF NOT EXISTS public.reactions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS reactions_post_idx ON public.reactions(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reactions_select_auth" ON public.reactions;
CREATE POLICY "reactions_select_auth" ON public.reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- stories
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT DEFAULT '',
  image_url TEXT,
  place text,
  place_lat double precision,
  place_lng double precision,
  tagged_people text[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at);
CREATE INDEX IF NOT EXISTS stories_author_idx ON public.stories(author_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active" ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND (body <> '' OR image_url IS NOT NULL));
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- user_books
CREATE TABLE IF NOT EXISTS public.user_books (
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
  page_count integer,
  current_page integer NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_books_user_idx ON public.user_books(user_id, status, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_books TO authenticated;
GRANT ALL ON public.user_books TO service_role;
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_books_select_auth" ON public.user_books;
CREATE POLICY "user_books_select_auth" ON public.user_books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_books_insert_own" ON public.user_books;
CREATE POLICY "user_books_insert_own" ON public.user_books FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_books_update_own" ON public.user_books;
CREATE POLICY "user_books_update_own" ON public.user_books FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_books_delete_own" ON public.user_books;
CREATE POLICY "user_books_delete_own" ON public.user_books FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS user_books_touch ON public.user_books;
CREATE TRIGGER user_books_touch BEFORE UPDATE ON public.user_books FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- user_films
CREATE TABLE IF NOT EXISTS public.user_films (
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
CREATE INDEX IF NOT EXISTS user_films_user_idx ON public.user_films(user_id, status, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_films TO authenticated;
GRANT ALL ON public.user_films TO service_role;
ALTER TABLE public.user_films ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_films_select_auth" ON public.user_films;
CREATE POLICY "user_films_select_auth" ON public.user_films FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_films_insert_own" ON public.user_films;
CREATE POLICY "user_films_insert_own" ON public.user_films FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_films_update_own" ON public.user_films;
CREATE POLICY "user_films_update_own" ON public.user_films FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_films_delete_own" ON public.user_films;
CREATE POLICY "user_films_delete_own" ON public.user_films FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS user_films_touch ON public.user_films;
CREATE TRIGGER user_films_touch BEFORE UPDATE ON public.user_films FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

-- friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships(requester_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friendships_select_involved ON public.friendships;
CREATE POLICY friendships_select_involved ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
DROP POLICY IF EXISTS friendships_insert_own ON public.friendships;
CREATE POLICY friendships_insert_own ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND status = 'pendiente');
DROP POLICY IF EXISTS friendships_update_addressee ON public.friendships;
CREATE POLICY friendships_update_addressee ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);
DROP POLICY IF EXISTS friendships_delete_involved ON public.friendships;
CREATE POLICY friendships_delete_involved ON public.friendships FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
DROP TRIGGER IF EXISTS friendships_touch ON public.friendships;
CREATE TRIGGER friendships_touch BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.tomelo_touch_updated_at();

REVOKE EXECUTE ON FUNCTION public.handle_new_user_tomelo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tomelo_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- storage policies
DROP POLICY IF EXISTS "tomelo_media_select_auth" ON storage.objects;
CREATE POLICY "tomelo_media_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tomelo-media');
DROP POLICY IF EXISTS "tomelo_media_insert_own" ON storage.objects;
CREATE POLICY "tomelo_media_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "tomelo_media_update_own" ON storage.objects;
CREATE POLICY "tomelo_media_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "tomelo_media_delete_own" ON storage.objects;
CREATE POLICY "tomelo_media_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);