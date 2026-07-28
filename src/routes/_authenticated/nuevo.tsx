import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadUserMedia } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/nuevo")({
  component: NuevoPost,
});

const schema = z.object({
  kind: z.enum(["libro", "cine", "arte"]),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(2000),
  place: z.string().trim().max(80).optional(),
  tagged: z.string().trim().max(200).optional(),
});

function NuevoPost() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [kind, setKind] = useState<"libro" | "cine" | "arte">("libro");
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
      const payload = schema.parse({
        kind,
        title: form.get("title") || undefined,
        body: form.get("body") || "",
        place: form.get("place") || undefined,
        tagged: form.get("tagged") || undefined,
      });
      let image_path: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Imagen máx. 5 MB");
        image_path = await uploadUserMedia(user.id, file);
      }
      const tagged_people = (payload.tagged ?? "")
        .split(",")
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean)
        .slice(0, 10);
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        kind: payload.kind,
        title: payload.title ?? null,
        body: payload.body,
        image_url: image_path,
        place: payload.place ?? null,
        tagged_people,
      });
      if (error) throw error;
      toast.success("Publicado");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment text-ink pb-24">
      <header className="sticky top-0 z-30 bg-parchment/85 backdrop-blur-md border-b border-ink/5 px-5 py-4 flex items-center gap-3">
        <Link to="/feed" aria-label="Volver" className="p-1 rounded-full hover:bg-ink/5">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <h1 className="font-serif text-xl">Nueva publicación</h1>
      </header>

      <form onSubmit={onSubmit} className="max-w-[560px] mx-auto px-5 py-6 space-y-5">
        <div className="flex gap-2">
          {(["libro", "cine", "arte"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                kind === k ? "bg-ink text-parchment" : "border border-ink/15 hover:bg-ink/5"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-ink/50 mb-1.5 block">
            Foto (opcional)
          </span>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="preview"
                className="w-full aspect-[4/5] object-cover rounded-2xl"
              />
              <button
                type="button"
                onClick={() => onFile(null)}
                className="absolute top-2 right-2 rounded-full bg-ink/70 text-parchment text-xs px-3 py-1"
              >
                Quitar
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:rounded-full file:border file:border-ink/15 file:bg-card file:px-4 file:py-2 file:mr-3 file:text-xs file:font-medium file:hover:bg-ink/5"
            />
          )}
        </label>

        <Field label="Título (opcional)">
          <input
            name="title"
            maxLength={120}
            placeholder="p. ej. La invención de la soledad"
            className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
          />
        </Field>

        <Field label="Nota">
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={5}
            placeholder="¿Qué te llevas de esta lectura, escena, obra?"
            className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40 resize-none"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Café o lugar">
            <input
              name="place"
              maxLength={80}
              placeholder="Café Central"
              className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
            />
          </Field>
          <Field label="Con quién (separado por coma)">
            <input
              name="tagged"
              maxLength={200}
              placeholder="marina, lucia"
              className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-ink text-parchment px-4 py-3 text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Publicando…" : "Publicar"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-ink/50 mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
