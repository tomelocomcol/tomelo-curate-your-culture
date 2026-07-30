import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil, X, Loader2, Coffee, Film, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadUserMedia } from "@/lib/storage";
import { SmartImage } from "./SmartImage";

export function ProfileHeader({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const p = profileQ.data;

  async function onAvatar(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadUserMedia(userId, file);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
    }
  }

  if (!p) return null;

  const genres = p.favorite_genres ?? [];

  return (
    <>
      <section className="px-5 pt-6 pb-5 border-b border-ink/5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="size-20 rounded-full overflow-hidden bg-leather/15 grid place-items-center text-xl font-semibold text-leather">
              {p.avatar_url ? (
                <SmartImage path={p.avatar_url} alt={p.display_name} className="size-full object-cover" />
              ) : (
                (p.display_name ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 size-7 rounded-full bg-ink text-parchment grid place-items-center border-2 border-parchment"
              aria-label="Cambiar foto"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatar(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl truncate">{p.display_name}</h2>
              <button
                onClick={() => setEditing(true)}
                className="text-ink/40 hover:text-ink"
                aria-label="Editar perfil"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-ink/50 font-mono">@{p.username}</p>
            {p.bio && <p className="mt-2 text-sm text-ink/70 leading-snug">{p.bio}</p>}

            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-clay/10 text-leather text-[10px] uppercase tracking-widest px-2.5 py-1"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            <dl className="mt-3 space-y-1 text-xs text-ink/60">
              {p.favorite_cafes && (
                <div className="flex items-start gap-1.5">
                  <Coffee className="h-3.5 w-3.5 mt-[1px] text-clay" />
                  <span>{p.favorite_cafes}</span>
                </div>
              )}
              {p.favorite_cinemas && (
                <div className="flex items-start gap-1.5">
                  <Film className="h-3.5 w-3.5 mt-[1px] text-clay" />
                  <span>{p.favorite_cinemas}</span>
                </div>
              )}
              {p.favorite_film && (
                <div className="flex items-start gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 mt-[1px] text-clay" />
                  <span>Película favorita: {p.favorite_film}</span>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      {editing && (
        <EditProfileDialog
          userId={userId}
          initial={{
            display_name: p.display_name ?? "",
            bio: p.bio ?? "",
            favorite_genres: (p.favorite_genres ?? []).join(", "),
            favorite_cafes: p.favorite_cafes ?? "",
            favorite_cinemas: p.favorite_cinemas ?? "",
            favorite_film: p.favorite_film ?? "",
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["profile"] });
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

type FormState = {
  display_name: string;
  bio: string;
  favorite_genres: string;
  favorite_cafes: string;
  favorite_cinemas: string;
  favorite_film: string;
};

function EditProfileDialog({
  userId,
  initial,
  onClose,
  onSaved,
}: {
  userId: string;
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  useEffect(() => setForm(initial), []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          bio: form.bio.trim(),
          favorite_genres: form.favorite_genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
            .slice(0, 12),
          favorite_cafes: form.favorite_cafes.trim(),
          favorite_cinemas: form.favorite_cinemas.trim(),
          favorite_film: form.favorite_film.trim(),
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const field = (label: string, key: keyof FormState, placeholder: string, area = false) => (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-ink/50 mb-1.5 block">{label}</span>
      {area ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={3}
          maxLength={280}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
        />
      ) : (
        <input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          maxLength={160}
          placeholder={placeholder}
          className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
        />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
          <h2 className="font-serif text-lg">Editar perfil</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink/50 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {field("Nombre", "display_name", "Tu nombre")}
          {field("Géneros literarios favoritos", "favorite_genres", "Novela negra, ensayo, poesía")}
          {field("Cines favoritos", "favorite_cinemas", "Cine Colombia, Cinemateca…")}
          {field("Cafés favoritos", "favorite_cafes", "Café Amor Perfecto, Azahar…")}
          {field("Película favorita", "favorite_film", "Cinema Paradiso")}
          {field("Breve biografía", "bio", "Cuéntanos algo sobre ti", true)}
        </div>
        <div className="p-5 pt-3 border-t border-ink/10">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full rounded-full bg-ink text-parchment py-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
