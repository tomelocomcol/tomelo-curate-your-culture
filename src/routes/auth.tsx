import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/feed" });
  },
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

const signUpSchema = signInSchema.extend({
  display_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form) as Record<string, string>;

    try {
      if (mode === "signup") {
        const parsed = signUpSchema.parse(payload);
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { display_name: parsed.display_name },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. ¡Bienvenida a Tomelo!");
        navigate({ to: "/feed" });
      } else {
        const parsed = signInSchema.parse(payload);
        const { error } = await supabase.auth.signInWithPassword(parsed);
        if (error) throw error;
        navigate({ to: "/feed" });
      }
    } catch (err) {
      const msg =
        err instanceof z.ZodError
          ? err.errors[0]?.message
          : err instanceof Error
            ? err.message
            : "Algo salió mal";
      toast.error(msg ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No se pudo iniciar con Google");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/feed" });
  }

  return (
    <div className="min-h-screen bg-parchment text-ink flex flex-col">
      <header className="px-6 pt-6">
        <Link
          to="/"
          className="font-serif italic text-2xl font-semibold text-leather"
        >
          Tomelo
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl leading-tight text-balance">
            {mode === "signup" ? "Crea tu cuenta" : "Entra a tu diario"}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {mode === "signup"
              ? "Empieza a guardar lo que lees, ves y mirás."
              : "Nos alegra volver a verte."}
          </p>

          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-card px-4 py-3 text-sm font-medium hover:bg-ink/5 transition-colors disabled:opacity-50"
          >
            <GoogleIcon /> Continuar con Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink/40">
            <div className="h-px flex-1 bg-ink/10" />
            <span>o con correo</span>
            <div className="h-px flex-1 bg-ink/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Nombre">
                <input
                  name="display_name"
                  required
                  maxLength={60}
                  placeholder="Ana Pérez"
                  className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
                />
              </Field>
            )}
            <Field label="Correo">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={255}
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
              />
            </Field>
            <Field label="Contraseña">
              <input
                name="password"
                type="password"
                required
                minLength={6}
                maxLength={128}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink text-parchment px-4 py-3 text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Un momento…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-ink/60">
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="hover:text-ink"
            >
              {mode === "signup" ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
            {mode === "signin" && (
              <Link to="/forgot-password" className="hover:text-ink">
                ¿Olvidaste tu contraseña?
              </Link>
            )}
          </div>
        </div>
      </main>
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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9c-.25 1.37-1.02 2.53-2.17 3.31v2.75h3.51c2.06-1.9 3.26-4.7 3.26-8.07z" />
      <path fill="#34A853" d="M12 23c2.94 0 5.4-.98 7.2-2.65l-3.51-2.75c-.98.66-2.23 1.05-3.69 1.05-2.84 0-5.24-1.92-6.1-4.5H2.28v2.83A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.9 14.15A6.6 6.6 0 0 1 5.55 12c0-.75.13-1.48.35-2.15V7.02H2.28A11 11 0 0 0 1 12c0 1.78.43 3.46 1.28 4.98l3.62-2.83z" />
      <path fill="#EA4335" d="M12 5.5c1.6 0 3.04.55 4.17 1.63l3.12-3.12C17.4 2.18 14.94 1 12 1 7.7 1 3.99 3.47 2.28 7.02L5.9 9.85C6.76 7.27 9.16 5.5 12 5.5z" />
    </svg>
  );
}
