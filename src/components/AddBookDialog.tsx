import { useState } from "react";
import { toast } from "sonner";
import { Search, X, Upload } from "lucide-react";
import { searchBooks, type OpenLibraryBook } from "@/lib/openlibrary";
import { supabase } from "@/integrations/supabase/client";
import { uploadUserMedia } from "@/lib/storage";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["book_status"];

export function AddBookDialog({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OpenLibraryBook[]>([]);
  const [selected, setSelected] = useState<OpenLibraryBook | null>(null);
  const [manual, setManual] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>("pendiente");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      setResults(await searchBooks(q));
    } catch {
      toast.error("No se pudo buscar");
    } finally {
      setSearching(false);
    }
  }

  function onFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function saveFromSearch() {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("user_books").insert({
        user_id: userId,
        openlibrary_key: selected.key,
        title: selected.title,
        author: selected.author,
        cover_url: selected.cover_url,
        status,
      });
      if (error) throw error;
      toast.success("Añadido a tu biblioteca");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const author = String(form.get("author") ?? "").trim() || null;
      if (!title) throw new Error("El título es obligatorio");
      let cover_url: string | null = null;
      if (file) {
        if (file.size > 3 * 1024 * 1024) throw new Error("Portada máx. 3 MB");
        cover_url = await uploadUserMedia(userId, file);
      }
      const { error } = await supabase.from("user_books").insert({
        user_id: userId,
        title,
        author,
        cover_url,
        status,
      });
      if (error) throw error;
      toast.success("Añadido a tu biblioteca");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-parchment w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl">Añadir libro</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-ink/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setManual(false)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${!manual ? "bg-ink text-parchment" : "border border-ink/15"}`}
          >
            Buscar
          </button>
          <button
            onClick={() => setManual(true)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold ${manual ? "bg-ink text-parchment" : "border border-ink/15"}`}
          >
            Añadir manual
          </button>
        </div>

        <StatusPicker status={status} setStatus={setStatus} />

        {!manual ? (
          <>
            <form onSubmit={runSearch} className="mt-4 flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Título o autor…"
                className="flex-1 rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
              />
              <button
                type="submit"
                className="rounded-lg bg-ink text-parchment px-3 py-2 text-sm"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {searching && <p className="text-xs text-ink/50">Buscando…</p>}
              {results.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelected(b)}
                  className={`w-full flex gap-3 items-start text-left p-2 rounded-lg transition-colors ${selected?.key === b.key ? "bg-clay/10 ring-1 ring-clay/40" : "hover:bg-ink/5"}`}
                >
                  {b.cover_url ? (
                    <img src={b.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-leather/10 rounded" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.title}</p>
                    <p className="text-xs text-ink/50 truncate">
                      {b.author ?? "Autor desconocido"}
                      {b.first_publish_year ? ` · ${b.first_publish_year}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button
              disabled={!selected || saving}
              onClick={saveFromSearch}
              className="mt-4 w-full rounded-full bg-ink text-parchment px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Añadir a mi biblioteca"}
            </button>
          </>
        ) : (
          <form onSubmit={saveManual} className="mt-4 space-y-3">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Título"
              className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
            />
            <input
              name="author"
              maxLength={120}
              placeholder="Autor"
              className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
            />
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-ink/50 mb-1.5 block">
                Portada (opcional)
              </span>
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
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              )}
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-ink text-parchment px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusPicker({ status, setStatus }: { status: Status; setStatus: (s: Status) => void }) {
  const opts: { key: Status; label: string }[] = [
    { key: "leyendo", label: "Leyendo" },
    { key: "leido", label: "Leído" },
    { key: "pendiente", label: "Pendiente" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setStatus(o.key)}
          className={`flex-1 py-1.5 rounded-full text-xs font-medium ${
            status === o.key ? "bg-clay text-parchment" : "border border-ink/15 hover:bg-ink/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
