import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SmartImage } from "@/components/SmartImage";
import { uploadUserMedia } from "@/lib/storage";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["film_status"];

const TABS: { key: Status; label: string }[] = [
  { key: "viendo", label: "Viendo" },
  { key: "visto", label: "Vistas" },
  { key: "pendiente", label: "Pendientes" },
];

export const Route = createFileRoute("/_authenticated/cine")({
  component: Cine,
});

function Cine() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Status>("visto");
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const films = useQuery({
    queryKey: ["user_films", user.id, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_films")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", tab)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("¿Quitar esta película?")) return;
    const { error } = await supabase.from("user_films").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Eliminada");
      qc.invalidateQueries({ queryKey: ["user_films", user.id] });
    }
  }

  return (
    <AppShell showSettings title="Cine">
      <div className="px-5 py-5 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Filmoteca</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 rounded-full bg-ink text-parchment px-3 py-1.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>

      <nav className="flex gap-2 px-5 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-clay text-parchment" : "border border-ink/15 hover:bg-ink/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {films.data && films.data.length === 0 && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-ink/60">Nada aquí todavía.</p>
        </div>
      )}

      <div className="px-5 grid grid-cols-3 sm:grid-cols-4 gap-4 pb-8">
        {films.data?.map((f) => (
          <div key={f.id} className="group relative">
            <SmartImage
              path={f.poster_url}
              alt={f.title}
              className="w-full aspect-[2/3] object-cover rounded-lg bg-leather/10 outline outline-1 -outline-offset-1 outline-ink/5"
            />
            <p className="mt-2 text-[11px] font-semibold leading-tight line-clamp-2">
              {f.title}
              {f.year ? <span className="text-ink/50"> · {f.year}</span> : null}
            </p>
            {f.director && (
              <p className="text-[10px] text-ink/50 truncate">{f.director}</p>
            )}
            {f.rating && (
              <p className="text-[10px] text-clay font-semibold">★ {f.rating}/10</p>
            )}
            <button
              onClick={() => remove(f.id)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-ink/70 text-parchment size-6 grid place-items-center"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddFilmDialog
          userId={user.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["user_films", user.id] });
          }}
        />
      )}
    </AppShell>
  );
}

function AddFilmDialog({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<Status>("visto");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      if (!title) throw new Error("El título es obligatorio");
      const director = String(form.get("director") ?? "").trim() || null;
      const yearStr = String(form.get("year") ?? "").trim();
      const year = yearStr ? Number(yearStr) : null;
      const ratingStr = String(form.get("rating") ?? "").trim();
      const rating = ratingStr ? Number(ratingStr) : null;
      const notes = String(form.get("notes") ?? "").trim();
      let poster_url: string | null = null;
      if (file) {
        if (file.size > 3 * 1024 * 1024) throw new Error("Póster máx. 3 MB");
        poster_url = await uploadUserMedia(userId, file);
      }
      const { error } = await supabase.from("user_films").insert({
        user_id: userId,
        title,
        director,
        year,
        rating,
        notes,
        poster_url,
        status,
        watched_at: status === "visto" ? new Date().toISOString().slice(0, 10) : null,
      });
      if (error) throw error;
      toast.success("Añadida");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="bg-parchment w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-3"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-xl">Añadir película</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          {(["viendo", "visto", "pendiente"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium capitalize ${
                status === s ? "bg-clay text-parchment" : "border border-ink/15"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          name="title"
          required
          maxLength={200}
          placeholder="Título"
          className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
        />
        <input
          name="director"
          maxLength={120}
          placeholder="Director/a"
          className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="year"
            type="number"
            min="1888"
            max="2100"
            placeholder="Año"
            className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
          />
          <input
            name="rating"
            type="number"
            min="1"
            max="10"
            placeholder="Nota /10"
            className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
          />
        </div>
        <textarea
          name="notes"
          maxLength={1000}
          rows={3}
          placeholder="Comentarios (opcional)"
          className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm resize-none"
        />

        {preview ? (
          <div className="relative w-24">
            <img src={preview} alt="" className="w-24 h-36 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => onFile(null)}
              className="absolute -top-2 -right-2 rounded-full bg-ink text-parchment size-6 text-xs"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-ink/20 px-3 py-4 cursor-pointer text-xs text-ink/60">
            <Upload className="h-4 w-4" />
            Subir póster (opcional)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-ink text-parchment px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </div>
  );
}
