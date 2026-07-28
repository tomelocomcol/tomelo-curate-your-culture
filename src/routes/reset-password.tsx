import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and fires this event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If user landed here directly with an active session, allow update too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada");
    navigate({ to: "/feed" });
  }

  return (
    <div className="min-h-screen bg-parchment text-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl">Nueva contraseña</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-ink/60">
            Verificando el enlace… si no cargó, pide uno nuevo desde "Recuperar
            contraseña".
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              name="password"
              type="password"
              required
              minLength={6}
              maxLength={128}
              placeholder="Nueva contraseña"
              className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink text-parchment px-4 py-3 text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
