import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Image as ImageIcon, Loader2, Trash2, MapPin, AtSign, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "./SmartImage";
import { uploadUserMedia } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type StoryRow = {
  id: string;
  author_id: string;
  body: string | null;
  image_url: string | null;
  place: string | null;
  tagged_people: string[] | null;
  created_at: string;
  expires_at: string;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
};

type GroupedAuthor = {
  author_id: string;
  author: StoryRow["author"];
  stories: StoryRow[];
};


export function Stories({
  currentUserId,
  myAvatar,
}: {
  currentUserId: string;
  myAvatar?: string | null;
}) {
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const storiesQ = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select(
          "id, author_id, body, image_url, place, tagged_people, created_at, expires_at, author:profiles!stories_author_id_fkey(username, display_name, avatar_url)",
        )
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as StoryRow[];
    },
    refetchInterval: 60_000,
  });

  const grouped: GroupedAuthor[] = useMemo(() => {
    const map = new Map<string, GroupedAuthor>();
    for (const s of storiesQ.data ?? []) {
      const g = map.get(s.author_id);
      if (g) g.stories.push(s);
      else map.set(s.author_id, { author_id: s.author_id, author: s.author, stories: [s] });
    }
    // put current user first
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.author_id === currentUserId) return -1;
      if (b.author_id === currentUserId) return 1;
      const la = a.stories[a.stories.length - 1].created_at;
      const lb = b.stories[b.stories.length - 1].created_at;
      return lb.localeCompare(la);
    });
    return arr;
  }, [storiesQ.data, currentUserId]);

  const myGroup = grouped.find((g) => g.author_id === currentUserId);

  return (
    <>
      <div className="px-5 pt-5 pb-3 border-b border-ink/5">
        <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-1 px-1">
          <div className="relative shrink-0 w-16">
            <button
              onClick={() => (myGroup ? setViewerIndex(grouped.indexOf(myGroup)) : setComposerOpen(true))}
              className="flex flex-col items-center gap-1.5 w-16"
              aria-label={myGroup ? "Ver tu estado" : "Nuevo estado"}
            >
              <div
                className={`relative size-16 rounded-full ${myGroup ? "p-[2px] bg-gradient-to-br from-clay via-leather to-ink" : "border-2 border-dashed border-ink/25 bg-parchment"} flex items-center justify-center`}
              >
                <div className="size-full rounded-full bg-parchment p-[2px]">
                  <div className="size-full rounded-full overflow-hidden bg-leather/15 flex items-center justify-center text-sm font-semibold text-leather">
                    {myGroup?.stories.find((st) => st.image_url)?.image_url ? (
                      <SmartImage
                        path={myGroup.stories.find((st) => st.image_url)!.image_url}
                        alt="tu estado"
                        className="size-full object-cover"
                      />
                    ) : myAvatar ? (
                      <SmartImage path={myAvatar} alt="tú" className="size-full object-cover" />
                    ) : (
                      <Plus className="h-5 w-5 text-ink/40" strokeWidth={2} />
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-ink/60 truncate w-full text-center">
                Tu estado
              </span>
            </button>
            <button
              onClick={() => setComposerOpen(true)}
              aria-label="Nuevo estado"
              className="absolute top-11 right-0 size-5 rounded-full bg-clay text-parchment grid place-items-center border-2 border-parchment"
            >
              <Plus className="h-3 w-3" strokeWidth={3} />
            </button>
          </div>

          {grouped.map((g, i) => {
            if (g.author_id === currentUserId) return null;
            return (
              <button
                key={g.author_id}
                onClick={() => setViewerIndex(i)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-16"
              >
                <div className="relative size-16 rounded-full p-[2px] bg-gradient-to-br from-clay via-leather to-ink">
                  <div className="size-full rounded-full bg-parchment p-[2px]">
                    <div className="size-full rounded-full bg-leather/15 flex items-center justify-center text-sm font-semibold text-leather overflow-hidden">
                      {g.author?.avatar_url ? (
                        <SmartImage path={g.author.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        (g.author?.display_name ?? "?").slice(0, 1).toUpperCase()
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-ink/60 truncate w-full text-center">
                  {g.author?.display_name ?? "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {composerOpen && (
        <StoryComposer
          userId={currentUserId}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["stories"] });
            setComposerOpen(false);
          }}
        />
      )}

      {viewerIndex !== null && grouped[viewerIndex] && (
        <StoryViewer
          groups={grouped}
          startIndex={viewerIndex}
          currentUserId={currentUserId}
          onClose={() => setViewerIndex(null)}
          onDeleted={() => qc.invalidateQueries({ queryKey: ["stories"] })}
        />
      )}
    </>
  );
}

/* -------------------- Composer -------------------- */

function StoryComposer({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const publish = useMutation({
    mutationFn: async () => {
      if (!body.trim() && !file) throw new Error("Añade un texto o una imagen");
      let imagePath: string | null = null;
      if (file) imagePath = await uploadUserMedia(userId, file);
      const { error } = await supabase.from("stories").insert({
        author_id: userId,
        body: body.trim(),
        image_url: imagePath,
      });
      if (error) throw error;
    },
    onSuccess: onCreated,
  });

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-parchment rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
          <h2 className="font-serif text-lg">Nuevo estado</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="¿Qué estás leyendo, viendo o mirando?"
            className="w-full resize-none rounded-2xl border border-ink/15 bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
          />

          {previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt="vista previa"
                className="w-full aspect-[4/5] object-cover rounded-2xl"
              />
              <button
                onClick={() => setFile(null)}
                className="absolute top-2 right-2 size-8 rounded-full bg-ink/70 text-parchment flex items-center justify-center"
                aria-label="Quitar imagen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-ink"
            >
              <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
              {file ? "Cambiar imagen" : "Añadir imagen"}
            </button>
            <span className="text-[10px] text-ink/40 uppercase tracking-wider">
              Expira en 24h
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          {publish.error && (
            <p className="text-xs text-red-600">{(publish.error as Error).message}</p>
          )}

        </div>

        <div className="p-5 pt-3 border-t border-ink/10 bg-parchment">
          <button
            onClick={() => publish.mutate()}
            disabled={publish.isPending || (!body.trim() && !file)}
            className="w-full rounded-full bg-ink text-parchment py-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {publish.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Publicar estado
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Viewer -------------------- */

function StoryViewer({
  groups,
  startIndex,
  currentUserId,
  onClose,
  onDeleted,
}: {
  groups: GroupedAuthor[];
  startIndex: number;
  currentUserId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const group = groups[gi];
  const story = group?.stories[si];

  const next = () => {
    if (!group) return;
    if (si + 1 < group.stories.length) setSi(si + 1);
    else if (gi + 1 < groups.length) {
      setGi(gi + 1);
      setSi(0);
    } else onClose();
  };
  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      const pg = groups[gi - 1];
      setGi(gi - 1);
      setSi(pg.stories.length - 1);
    }
  };

  const del = useMutation({
    mutationFn: async () => {
      if (!story) return;
      const { error } = await supabase.from("stories").delete().eq("id", story.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onDeleted();
      onClose();
    },
  });

  if (!story) return null;
  const isMine = story.author_id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 bg-ink flex items-center justify-center animate-fade-in">
      <div className="relative w-full max-w-md h-full sm:h-auto sm:aspect-[9/16] sm:rounded-2xl overflow-hidden bg-ink/90">
        {/* progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {group.stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-parchment/25 rounded overflow-hidden">
              <div
                className={`h-full bg-parchment ${
                  idx < si ? "w-full" : idx === si ? "w-full animate-[storybar_5s_linear]" : "w-0"
                }`}
                onAnimationEnd={idx === si ? next : undefined}
              />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-3">
          <div className="size-9 rounded-full bg-leather/40 flex items-center justify-center text-sm font-semibold text-parchment">
            {(group.author?.display_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-parchment truncate">
              {group.author?.display_name ?? "—"}
            </p>
            <p className="text-[10px] text-parchment/60">
              {formatDistanceToNow(new Date(story.created_at), { locale: es, addSuffix: true })}
            </p>
          </div>
          {isMine && (
            <button
              onClick={() => del.mutate()}
              className="text-parchment/70 hover:text-parchment"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="text-parchment/70 hover:text-parchment" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {story.image_url ? (
            <SmartImage
              path={story.image_url}
              alt="estado"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="p-10 text-center">
              <p className="font-serif text-2xl text-parchment leading-snug whitespace-pre-wrap">
                {story.body}
              </p>
            </div>
          )}
          {story.image_url && story.body && (
            <div className="absolute bottom-8 left-0 right-0 px-6">
              <p className="text-parchment text-base whitespace-pre-wrap bg-ink/50 backdrop-blur rounded-2xl px-4 py-3">
                {story.body}
              </p>
            </div>
          )}
        </div>

        {/* nav zones */}
        <button
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 z-10"
          aria-label="Anterior"
        />
        <button
          onClick={next}
          className="absolute inset-y-0 right-0 w-2/3 z-10"
          aria-label="Siguiente"
        />
      </div>

      <style>{`@keyframes storybar { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
