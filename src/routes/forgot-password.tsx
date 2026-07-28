import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  component: ForgotPassword,
});

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Correo inválido");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-parchment text-ink flex flex-col">
      <header className="px-6 pt-6">
        <Link to="/" className="font-serif italic text-2xl font-semibold text-leather">
          Tomelo
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl">Recuperar contraseña</h1>
          {sent ? (
            <p className="mt-4 text-sm text-ink/70">
              Te enviamos un correo con el enlace para restablecer tu contraseña.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink/60">
                Te enviaremos un enlace para restablecerla.
              </p>
              <form onSubmit={onSubmit} className="mt-8 space-y-3">
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  placeholder="tu@correo.com"
                  className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-ink text-parchment px-4 py-3 text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Enviando…" : "Enviar enlace"}
                </button>
              </form>
            </>
          )}
          <Link to="/auth" className="mt-6 inline-block text-xs text-ink/60 hover:text-ink">
            ← Volver
          </Link>
        </div>
      </main>
    </div>
  );
}
