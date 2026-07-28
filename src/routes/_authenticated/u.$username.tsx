import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { SmartImage } from "@/components/SmartImage";

type Tab = "feed" | "libros" | "cine";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("feed");

  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const isMe = profile.data?.id === user.id;

  const posts = useQuery({
    queryKey: ["profile-posts", profile.data?.id],
    enabled: !!profile.data?.id && tab === "feed",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, author_id, kind, title, body, image_url, place, tagged_people, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url)",
        )
        .eq("author_id", profile.data!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PostRow[];
    },
  });

  const books = useQuery({
    queryKey: ["profile-books", profile.data?.id],
    enabled: !!profile.data?.id && tab === "libros",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("*")
        .eq("user_id", profile.data!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const films = useQuery({
    queryKey: ["profile-films", profile.data?.id],
    enabled: !!profile.data?.id && tab === "cine",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_films")
        .select("*")
        .eq("user_id", profile.data!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell showSettings={isMe}>
      {profile.data && (
        <div className="px-5 pt-6 pb-4 text-center">
          <div className="mx-auto size-20 rounded-full bg-leather/15 flex items-center justify-center text-2xl font-serif text-leather">
            {profile.data.display_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-3 font-serif text-2xl">{profile.data.display_name}</h1>
          <p className="text-xs text-ink/50">@{profile.data.username}</p>
          {profile.data.bio && (
            <p className="mt-3 text-sm text-ink/70 max-w-sm mx-auto leading-relaxed">
              {profile.data.bio}
            </p>
          )}
        </div>
      )}

      <nav className="flex gap-2 px-5 py-3 justify-center border-b border-ink/5">
        {(["feed", "libros", "cine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === t ? "bg-ink text-parchment" : "text-ink/50 hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "feed" && (
        <>
          {posts.data?.length === 0 && (
            <p className="px-5 py-16 text-center text-sm text-ink/50">
              Sin publicaciones aún.
            </p>
          )}
          {posts.data?.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={user.id} />
          ))}
        </>
      )}

      {tab === "libros" && (
        <div className="px-5 py-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
          {books.data?.length === 0 && (
            <p className="col-span-full text-center py-8 text-sm text-ink/50">
              Sin libros en la biblioteca.
            </p>
          )}
          {books.data?.map((b) => (
            <div key={b.id}>
              <SmartImage
                path={b.cover_url}
                alt={b.title}
                className="w-full aspect-[2/3] object-cover rounded-lg bg-leather/10"
              />
              <p className="mt-2 text-[11px] font-semibold leading-tight line-clamp-2">
                {b.title}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-clay">
                {b.status}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "cine" && (
        <div className="px-5 py-5 grid grid-cols-3 sm:grid-cols-4 gap-4">
          {films.data?.length === 0 && (
            <p className="col-span-full text-center py-8 text-sm text-ink/50">
              Sin películas.
            </p>
          )}
          {films.data?.map((f) => (
            <div key={f.id}>
              <SmartImage
                path={f.poster_url}
                alt={f.title}
                className="w-full aspect-[2/3] object-cover rounded-lg bg-leather/10"
              />
              <p className="mt-2 text-[11px] font-semibold leading-tight line-clamp-2">
                {f.title}
              </p>
              {f.rating && (
                <p className="text-[10px] text-clay font-semibold">★ {f.rating}/10</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
