import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/feed" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-parchment text-ink">
      <header className="px-6 pt-6 flex items-center justify-between">
        <h1 className="font-serif italic text-2xl font-semibold text-leather">Tomelo</h1>
        <Link
          to="/auth"
          className="text-sm font-medium text-ink/70 hover:text-ink transition-colors"
        >
          Entrar
        </Link>
      </header>

      <main className="px-6 pt-20 pb-28 max-w-[560px] mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-leather mb-6">
          Una red social lenta
        </p>
        <h2 className="font-serif text-5xl leading-[1.05] text-balance">
          Tu diario de <em className="text-clay">literatura</em>, cine y arte.
        </h2>
        <p className="mt-6 text-base text-ink/70 leading-relaxed text-pretty">
          Publica lo que estás leyendo desde ese café, guarda las películas que te
          marcaron, arma tu biblioteca y descubre lo que otros están leyendo.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center justify-center rounded-full bg-ink text-parchment px-6 py-3 text-sm font-semibold hover:bg-ink/90 transition-colors"
          >
            Crear cuenta
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full border border-ink/15 px-6 py-3 text-sm font-medium hover:bg-ink/5 transition-colors"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              t: "Un feed sin ruido",
              d: "Comparte notas de lectura, reseñas de cine, imágenes de arte. Etiqueta cafés y compañía.",
            },
            {
              t: "Biblioteca personal",
              d: "Portadas de Open Library. Marca lo que lees, terminaste o dejaste pendiente.",
            },
            {
              t: "Tu filmoteca",
              d: "Películas que viste, con notas, fechas y una calificación honesta.",
            },
          ].map((f) => (
            <div key={f.t}>
              <p className="text-[10px] uppercase tracking-widest text-leather mb-2">
                {f.t}
              </p>
              <p className="text-sm text-ink/75 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 pb-10 text-center text-xs text-ink/40">
        Hecho para quienes leen despacio.
      </footer>
    </div>
  );
}
