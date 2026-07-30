import { useState } from "react";
import { Trash2, Play, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "./SmartImage";
import type { Database } from "@/integrations/supabase/types";

type Book = Database["public"]["Tables"]["user_books"]["Row"];

export function BookCard({
  book,
  onChanged,
  onRemove,
}: {
  book: Book;
  onChanged: () => void;
  onRemove: (id: string) => void;
}) {
  const [page, setPage] = useState(String(book.current_page ?? 0));
  const [total, setTotal] = useState(book.page_count ? String(book.page_count) : "");
  const [saving, setSaving] = useState(false);

  const pct =
    book.status === "leido"
      ? 100
      : book.page_count && book.page_count > 0
        ? Math.min(100, Math.round(((book.current_page ?? 0) / book.page_count) * 100))
        : 0;

  async function update(patch: Partial<Book>) {
    setSaving(true);
    const { error } = await supabase.from("user_books").update(patch).eq("id", book.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else onChanged();
  }

  async function saveProgress() {
    const p = Math.max(0, parseInt(page || "0", 10) || 0);
    const t = total ? Math.max(1, parseInt(total, 10) || 1) : null;
    const done = t !== null && p >= t;
    await update({
      current_page: done ? t : p,
      page_count: t,
      status: done ? "leido" : "leyendo",
      finished_at: done ? new Date().toISOString().slice(0, 10) : null,
    });
    if (done) toast.success("¡Terminado! Movido a Leídos");
  }

  return (
    <article className="rounded-2xl border border-ink/10 bg-card p-3 flex gap-3">
      <SmartImage
        path={book.cover_url}
        alt={book.title}
        className="w-16 shrink-0 aspect-[2/3] object-cover rounded-lg bg-leather/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight line-clamp-2">{book.title}</p>
            {book.author && <p className="text-[11px] text-ink/50 truncate">{book.author}</p>}
          </div>
          <button
            onClick={() => onRemove(book.id)}
            className="text-ink/30 hover:text-ink"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {book.status === "pendiente" && (
          <button
            onClick={() => update({ status: "leyendo", started_at: new Date().toISOString().slice(0, 10) })}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-clay text-parchment px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> Iniciar lectura
          </button>
        )}

        {book.status === "leyendo" && (
          <div className="mt-3 space-y-2">
            <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full bg-clay transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-ink/50">
              {book.page_count
                ? `${book.current_page ?? 0} / ${book.page_count} págs · ${pct}%`
                : "Añade el total de páginas"}
            </p>
            <div className="flex items-center gap-2">
              <input
                value={page}
                onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Pág."
                className="w-16 rounded-lg border border-ink/15 bg-parchment px-2 py-1 text-xs"
              />
              <span className="text-xs text-ink/40">/</span>
              <input
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Total"
                className="w-16 rounded-lg border border-ink/15 bg-parchment px-2 py-1 text-xs"
              />
              <button
                onClick={saveProgress}
                disabled={saving}
                className="rounded-full bg-ink text-parchment px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>
            <button
              onClick={() =>
                update({
                  status: "leido",
                  current_page: book.page_count ?? book.current_page,
                  finished_at: new Date().toISOString().slice(0, 10),
                })
              }
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs text-leather hover:underline"
            >
              <Check className="h-3 w-3" /> Marcar como leído
            </button>
          </div>
        )}

        {book.status === "leido" && (
          <div className="mt-3 space-y-2">
            <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div className="h-full bg-leather w-full" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-leather">
                Leído 100%
              </span>
              <button
                onClick={() => update({ status: "leyendo", finished_at: null })}
                className="text-[11px] text-ink/50 hover:underline"
              >
                Volver a leer
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
