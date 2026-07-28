import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, LogOut, KeyRound, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ajustes")({
  component: Ajustes,
});

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  username: z.string().trim().regex(/^[a-z0-9_]{3,24}$/, "3-24, minúsculas, números o _"),
  bio: z.string().trim().max(280),
});

function Ajustes() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ display_name: "", username: "", bio: "" });
  useEffect(() => {
    if (profile.data) {
      setForm({
        display_name: profile.data.display_name ?? "",
        username: profile.data.username ?? "",
        bio: profile.data.bio ?? "",
      });
    }
  }, [profile.data]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = profileSchema.parse(form);
      const { error } = await supabase
        .from("profiles")
        .update(parsed)
        .eq("id", user.id);
      if (error) {
        if (error.code === "23505") throw new Error("Ese nombre de usuario ya está tomado");
        throw error;
      }
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      const msg =
        err instanceof z.ZodError
          ? err.errors[0]?.message
          : err instanceof Error
            ? err.message
            : "Error";
      toast.error(msg ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  async function sendReset() {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email ?? "", {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Te enviamos un correo para cambiar la contraseña");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-parchment text-ink pb-24">
      <header className="sticky top-0 z-30 bg-parchment/85 backdrop-blur-md border-b border-ink/5 px-5 py-4 flex items-center gap-3">
        <Link to="/feed" aria-label="Volver" className="p-1 rounded-full hover:bg-ink/5">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <h1 className="font-serif text-xl">Ajustes</h1>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-6 space-y-8">
        <section>
          <h2 className="font-serif text-lg mb-3">Perfil</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <Field label="Nombre visible">
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                maxLength={60}
                className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="Nombre de usuario">
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                maxLength={24}
                className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm font-mono"
              />
            </Field>
            <Field label="Bio">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                maxLength={280}
                rows={3}
                className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm resize-none"
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-ink text-parchment px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-leather" strokeWidth={1.75} />
            Seguridad
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-ink/60">
              Correo: <span className="text-ink">{user.email}</span>
            </p>
            <p className="text-xs text-ink/50 leading-relaxed">
              Tu contraseña se comprueba contra la base de datos "Have I Been Pwned" al
              crearla y cambiarla; si aparece filtrada, te la rechazamos.
            </p>
            <button
              onClick={sendReset}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm hover:bg-ink/5"
            >
              <KeyRound className="h-4 w-4" strokeWidth={1.75} />
              Cambiar contraseña por correo
            </button>
          </div>
        </section>

        <section>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-2 text-sm font-semibold"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </section>
      </div>
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
