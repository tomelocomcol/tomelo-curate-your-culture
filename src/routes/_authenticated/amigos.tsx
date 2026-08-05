import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/amigos")({
  component: AmigosPage,
});

type ProfileLite = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pendiente" | "aceptada";
};

function AmigosPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");

  const links = useQuery({
    queryKey: ["friendships", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (error) throw error;
      return data as Friendship[];
    },
  });

  const otherIds = (links.data ?? []).map((l) =>
    l.requester_id === user.id ? l.addressee_id : l.requester_id,
  );

  const people = useQuery({
    queryKey: ["friend-profiles", otherIds.join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", otherIds);
      if (error) throw error;
      return data as ProfileLite[];
    },
  });

  const search = useQuery({
    queryKey: ["profile-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const q = term.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user.id)
        .limit(20);
      if (error) throw error;
      return data as ProfileLite[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["friendships", user.id] });
    qc.invalidateQueries({ queryKey: ["friend-profiles"] });
  };

  const sendRequest = useMutation({
    mutationFn: async (addressee_id: string) => {
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user.id, addressee_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitud enviada");
      refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud"),
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "aceptada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Ahora son amigos!");
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listo");
      refresh();
    },
  });

  const byId = new Map((people.data ?? []).map((p) => [p.id, p]));
  const all = links.data ?? [];
  const friends = all.filter((l) => l.status === "aceptada");
  const incoming = all.filter(
    (l) => l.status === "pendiente" && l.addressee_id === user.id,
  );
  const outgoing = all.filter(
    (l) => l.status === "pendiente" && l.requester_id === user.id,
  );

  function linkWith(id: string) {
    return all.find((l) => l.requester_id === id || l.addressee_id === id);
  }

  return (
    <AppShell showSettings title="Amistades">
      <div className="px-5 py-5">
        <h1 className="font-serif text-3xl">Amistades</h1>
        <p className="text-xs text-ink/50 mt-1">
          Busca lectoras y lectores, envía solicitudes y arma tu círculo.
        </p>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o @usuario…"
            className="w-full rounded-full border border-ink/15 bg-card pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
          />
        </div>
      </div>

      {term.trim().length >= 2 && (
        <Section title="Resultados">
          {search.isLoading && <Empty>Buscando…</Empty>}
          {search.data?.length === 0 && <Empty>Sin resultados.</Empty>}
          {search.data?.map((p) => {
            const rel = linkWith(p.id);
            return (
              <Row key={p.id} person={p}>
                {!rel && (
                  <Action
                    onClick={() => sendRequest.mutate(p.id)}
                    icon={<UserPlus className="h-3.5 w-3.5" />}
                    label="Agregar"
                  />
                )}
                {rel?.status === "pendiente" && rel.requester_id === user.id && (
                  <Tag>Solicitud enviada</Tag>
                )}
                {rel?.status === "pendiente" && rel.addressee_id === user.id && (
                  <Action
                    onClick={() => accept.mutate(rel.id)}
                    icon={<Check className="h-3.5 w-3.5" />}
                    label="Aceptar"
                  />
                )}
                {rel?.status === "aceptada" && <Tag>Amigos</Tag>}
              </Row>
            );
          })}
        </Section>
      )}

      {incoming.length > 0 && (
        <Section title={`Solicitudes recibidas (${incoming.length})`}>
          {incoming.map((l) => {
            const p = byId.get(l.requester_id);
            if (!p) return null;
            return (
              <Row key={l.id} person={p}>
                <Action
                  onClick={() => accept.mutate(l.id)}
                  icon={<Check className="h-3.5 w-3.5" />}
                  label="Aceptar"
                />
                <Action
                  onClick={() => remove.mutate(l.id)}
                  icon={<X className="h-3.5 w-3.5" />}
                  label="Rechazar"
                  ghost
                />
              </Row>
            );
          })}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Solicitudes enviadas">
          {outgoing.map((l) => {
            const p = byId.get(l.addressee_id);
            if (!p) return null;
            return (
              <Row key={l.id} person={p}>
                <Action
                  onClick={() => remove.mutate(l.id)}
                  icon={<X className="h-3.5 w-3.5" />}
                  label="Cancelar"
                  ghost
                />
              </Row>
            );
          })}
        </Section>
      )}

      <Section title={`Mis amigos (${friends.length})`}>
        {friends.length === 0 && (
          <Empty>Todavía no tienes amistades. Busca a alguien arriba.</Empty>
        )}
        {friends.map((l) => {
          const p = byId.get(l.requester_id === user.id ? l.addressee_id : l.requester_id);
          if (!p) return null;
          return (
            <Row key={l.id} person={p}>
              <Action
                onClick={() => {
                  if (confirm(`¿Eliminar a ${p.display_name} de tus amigos?`))
                    remove.mutate(l.id);
                }}
                icon={<X className="h-3.5 w-3.5" />}
                label="Quitar"
                ghost
              />
            </Row>
          );
        })}
      </Section>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pb-6">
      <h2 className="text-[10px] uppercase tracking-widest text-ink/50 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink/50 py-3">{children}</p>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-widest text-ink/45 px-2">
      {children}
    </span>
  );
}

function Action({
  onClick,
  icon,
  label,
  ghost,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        ghost
          ? "border border-ink/15 text-ink/60 hover:bg-ink/5"
          : "bg-ink text-parchment hover:bg-ink/90"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({ person, children }: { person: ProfileLite; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/10 px-3 py-2.5">
      <div className="size-10 rounded-full bg-leather/15 flex items-center justify-center text-sm font-semibold text-leather shrink-0">
        {person.display_name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          to="/u/$username"
          params={{ username: person.username }}
          className="text-sm font-semibold hover:underline block truncate"
        >
          {person.display_name}
        </Link>
        <p className="text-[11px] text-ink/50 truncate">@{person.username}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}
