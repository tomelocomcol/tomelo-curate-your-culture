CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX stories_expires_idx ON public.stories(expires_at);
CREATE INDEX stories_author_idx ON public.stories(author_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_active" ON public.stories
  FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "stories_insert_own" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND (body <> '' OR image_url IS NOT NULL));

CREATE POLICY "stories_delete_own" ON public.stories
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id);