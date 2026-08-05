import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "./SmartImage";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const REACTIONS = ["❤️", "📖", "🎬", "🎨", "✨", "🔥"] as const;

export interface PostRow {
  id: string;
  author_id: string;
  kind: "libro" | "cine" | "arte";
  title: string | null;
  body: string;
  image_url: string | null;
  place: string | null;
  tagged_people: string[];
  created_at: string;
  author: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export function PostCard({ post, currentUserId }: { post: PostRow; currentUserId: string }) {
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const isMine = post.author_id === currentUserId;

  const updatePost = useMutation({
    mutationFn: async (values: { title: string; body: string; place: string }) => {
      const { error } = await supabase
        .from("posts")
        .update({
          title: values.title || null,
          body: values.body,
          place: values.place || null,
        })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicación actualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["profile-posts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo editar"),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      await supabase.from("comments").delete().eq("post_id", post.id);
      await supabase.from("reactions").delete().eq("post_id", post.id);
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publicación eliminada");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["profile-posts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const reactionsQ = useQuery({
    queryKey: ["reactions", post.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("emoji, user_id")
        .eq("post_id", post.id);
      if (error) throw error;
      return data;
    },
  });
  const commentsQ = useQuery({
    queryKey: ["comments", post.id],
    enabled: showComments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, created_at, author_id, author:profiles!comments_author_id_fkey(display_name, username)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const commentCountQ = useQuery({
    queryKey: ["comment-count", post.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id);
      return count ?? 0;
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const mine = reactionsQ.data?.some((r) => r.user_id === currentUserId && r.emoji === emoji);
      if (mine) {
        await supabase
          .from("reactions")
          .delete()
          .match({ post_id: post.id, user_id: currentUserId, emoji });
      } else {
        await supabase
          .from("reactions")
          .insert({ post_id: post.id, user_id: currentUserId, emoji });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reactions", post.id] }),
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("comments")
        .insert({ post_id: post.id, author_id: currentUserId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
      qc.invalidateQueries({ queryKey: ["comment-count", post.id] });
    },
  });

  const grouped = groupReactions(reactionsQ.data ?? []);
  const totalReactions = (reactionsQ.data ?? []).length;

  return (
    <article className="px-5 py-8 border-b border-ink/5 last:border-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-full bg-leather/15 flex items-center justify-center text-sm font-semibold text-leather">
          {(post.author?.display_name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to="/u/$username"
            params={{ username: post.author?.username ?? "" }}
            className="text-sm font-semibold hover:underline"
          >
            {post.author?.display_name ?? "Anónimo"}
          </Link>
          <p className="text-[10px] text-ink/50 uppercase tracking-wider truncate">
            {formatDistanceToNow(new Date(post.created_at), { locale: es, addSuffix: true })}
            {post.place && (
              <>
                {" · en "}
                <span className="text-clay">{post.place}</span>
              </>
            )}
          </p>
        </div>
        <KindBadge kind={post.kind} />
      </div>

      {post.image_url && (
        <SmartImage
          path={post.image_url}
          alt={post.title ?? "publicación"}
          className="w-full aspect-[4/5] object-cover rounded-2xl bg-leather/5"
        />
      )}

      {(post.title || post.body) && (
        <div className="mt-4 space-y-2">
          {post.title && (
            <h3 className="font-serif text-lg leading-tight text-balance">
              {post.title}
            </h3>
          )}
          {post.body && (
            <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
              {post.body}
            </p>
          )}
        </div>
      )}

      {post.tagged_people.length > 0 && (
        <p className="mt-3 text-xs text-ink/50">
          con{" "}
          {post.tagged_people.map((p, i) => (
            <span key={i} className="text-clay">
              @{p}
              {i < post.tagged_people.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {REACTIONS.map((e) => {
          const count = grouped[e] ?? 0;
          const mine = reactionsQ.data?.some(
            (r) => r.user_id === currentUserId && r.emoji === e,
          );
          return (
            <button
              key={e}
              onClick={() => toggleReaction.mutate(e)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs border transition-colors ${
                mine
                  ? "bg-clay/10 border-clay/30 text-clay"
                  : "border-ink/10 hover:border-ink/30 text-ink/60"
              }`}
            >
              <span className="text-sm leading-none">{e}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-ink/50 hover:text-ink"
        >
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
          {commentCountQ.data ?? 0}
        </button>
      </div>

      {totalReactions > 0 && (
        <p className="mt-2 text-[10px] text-ink/40">{totalReactions} reacciones</p>
      )}

      {showComments && (
        <div className="mt-5 space-y-3">
          <div className="space-y-2">
            {(commentsQ.data ?? []).map((c) => {
              const author = Array.isArray(c.author) ? c.author[0] : c.author;
              return (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold">{author?.display_name ?? "—"}</span>{" "}
                  <span className="text-ink/80">{c.body}</span>
                </div>
              );
            })}
            {commentsQ.data?.length === 0 && (
              <p className="text-xs text-ink/40">Sé la primera en comentar.</p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const body = String(form.get("body") ?? "").trim();
              if (!body) return;
              addComment.mutate(body, {
                onSuccess: () => (e.target as HTMLFormElement).reset(),
              });
            }}
            className="flex gap-2"
          >
            <input
              name="body"
              maxLength={500}
              placeholder="Escribe un comentario…"
              className="flex-1 rounded-full border border-ink/15 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
            />
            <button
              type="submit"
              className="rounded-full bg-ink text-parchment px-4 py-2 text-xs font-semibold hover:bg-ink/90"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function groupReactions(rows: Array<{ emoji: string }>) {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.emoji] = (out[r.emoji] ?? 0) + 1;
  return out;
}

function KindBadge({ kind }: { kind: "libro" | "cine" | "arte" }) {
  const map = {
    libro: { label: "Libro", bg: "bg-clay/10 text-clay" },
    cine: { label: "Cine", bg: "bg-ink text-parchment" },
    arte: { label: "Arte", bg: "bg-leather/15 text-leather" },
  } as const;
  const c = map[kind];
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${c.bg}`}
    >
      {c.label}
    </span>
  );
}
