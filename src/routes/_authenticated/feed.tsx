import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Stories } from "@/components/Stories";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "libro", label: "Libro" },
  { key: "cine", label: "Cine" },
  { key: "arte", label: "Arte" },
] as const;

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { user } = Route.useRouteContext();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todos");

  const posts = useQuery({
    queryKey: ["feed", filter],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select(
          "id, author_id, kind, title, body, image_url, place, tagged_people, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter !== "todos") q = q.eq("kind", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  return (
    <AppShell showSettings>
      <nav className="flex gap-2 px-5 py-5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? "bg-ink text-parchment"
                : "border border-ink/15 hover:bg-ink/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {posts.isLoading && (
        <p className="px-5 py-16 text-center text-sm text-ink/50">Cargando…</p>
      )}
      {posts.data && posts.data.length === 0 && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-ink/60">Todavía no hay publicaciones.</p>
          <Link
            to="/nuevo"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-ink text-parchment px-4 py-2 text-sm font-semibold"
          >
            Publica la primera
          </Link>
        </div>
      )}
      {posts.data?.map((p) => <PostCard key={p.id} post={p} currentUserId={user.id} />)}

      <Link
        to="/nuevo"
        aria-label="Nueva publicación"
        className="fixed bottom-24 right-6 z-40 size-14 rounded-full bg-clay text-parchment shadow-xl shadow-clay/30 flex items-center justify-center hover:scale-105 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </Link>
    </AppShell>
  );
}
