import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AddBookDialog } from "@/components/AddBookDialog";
import { BookCard } from "@/components/BookCard";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["book_status"];

const TABS: { key: Status; label: string }[] = [
  { key: "leyendo", label: "Leyendo" },
  { key: "leido", label: "Leídos" },
  { key: "pendiente", label: "Pendientes" },
];

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: Biblioteca,
});

function Biblioteca() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Status>("leyendo");
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const books = useQuery({
    queryKey: ["user_books", user.id, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", tab)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["user_books", user.id] });

  async function remove(id: string) {
    if (!confirm("¿Quitar este libro de tu biblioteca?")) return;
    const { error } = await supabase.from("user_books").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Eliminado");
      refresh();
    }
  }

  return (
    <AppShell showSettings title="Biblioteca">
      <div className="px-5 py-5 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Biblioteca</h1>
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

      {books.isLoading && (
        <p className="px-5 py-16 text-center text-sm text-ink/50">Cargando…</p>
      )}
      {books.data && books.data.length === 0 && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-ink/60">Nada por aquí todavía.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 rounded-full bg-ink text-parchment px-4 py-2 text-sm font-semibold"
          >
            Añadir un libro
          </button>
        </div>
      )}

      <div className="px-5 grid sm:grid-cols-2 gap-3 pb-8">
        {books.data?.map((b) => (
          <BookCard key={b.id} book={b} onChanged={refresh} onRemove={remove} />
        ))}
      </div>

      {showAdd && (
        <AddBookDialog
          userId={user.id}
          onClose={() => setShowAdd(false)}
          onSaved={(status) => {
            setShowAdd(false);
            setTab(status);
            refresh();
          }}
        />
      )}
    </AppShell>
  );
}
