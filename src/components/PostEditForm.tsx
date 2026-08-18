import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AtSign, ImageIcon, Loader2, MapPin, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "./SmartImage";
import { usePlaceSearch, mapEmbedSrc, type PlaceHit } from "@/lib/usePlaceSearch";

export type PostEditValues = {
  title: string;
  body: string;
  place: string | null;
  place_lat: number | null;
  place_lng: number | null;
  tagged_people: string[];
  file: File | null;
  removeImage: boolean;
};

export function PostEditForm({
  currentUserId,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  currentUserId: string;
  initial: {
    title: string | null;
    body: string;
    place: string | null;
    place_lat?: number | null;
    place_lng?: number | null;
    tagged_people: string[];
    image_url: string | null;
  };
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: PostEditValues) => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [body, setBody] = useState(initial.body);
  const [place, setPlace] = useState<PlaceHit | null>(
    initial.place
      ? {
          name: initial.place,
          lat: initial.place_lat ?? 0,
          lng: initial.place_lng ?? 0,
        }
      : null,
  );
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeTerm, setPlaceTerm] = useState("");
  const { results: placeResults, loading: placeLoading } = usePlaceSearch(placeTerm);

  const [tagged, setTagged] = useState<string[]>(initial.tagged_people ?? []);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleTerm, setPeopleTerm] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const friendsQ = useQuery({
    queryKey: ["friends-tag", currentUserId],
    enabled: peopleOpen,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .eq("status", "aceptada");
      if (error) throw error;
      const ids = (rows ?? [])
        .map((r) => (r.requester_id === currentUserId ? r.addressee_id : r.requester_id))
        .filter((id) => id !== currentUserId);
      let q = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .neq("id", currentUserId)
        .order("display_name")
        .limit(100);
      if (ids.length > 0) q = q.in("id", ids);
      const { data, error: e2 } = await q;
      if (e2) throw e2;
      return data ?? [];
    },
  });

  const peopleFiltered = (friendsQ.data ?? []).filter((p) => {
    const t = peopleTerm.trim().toLowerCase().replace(/^@/, "");
    if (!t) return true;
    return p.username.toLowerCase().includes(t) || p.display_name.toLowerCase().includes(t);
  });

  const showExistingImage = initial.image_url && !removeImage && !file;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title: title.trim(),
          body: body.trim(),
          place: place?.name ?? null,
          place_lat: place && place.lat ? place.lat : null,
          place_lng: place && place.lng ? place.lng : null,
          tagged_people: tagged,
          file,
          removeImage,
        });
      }}
      className="mt-4 space-y-3"
    >
      {/* Foto */}
      <div className="rounded-2xl border border-ink/10 bg-card/60 p-3 space-y-2">
        {showExistingImage && (
          <SmartImage
            path={initial.image_url}
            alt="foto actual"
            className="w-full aspect-[4/5] object-cover rounded-xl"
          />
        )}
        {previewUrl && (
          <img src={previewUrl} alt="nueva foto" className="w-full aspect-[4/5] object-cover rounded-xl" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-ink/70 hover:text-ink cursor-pointer">
            <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
            {initial.image_url || file ? "Cambiar foto" : "Añadir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setRemoveImage(false);
              }}
            />
          </label>
          {(initial.image_url || file) && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setRemoveImage(true);
              }}
              className="text-xs text-clay hover:underline"
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Título"
        className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leather/40"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Nota"
        className="w-full rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-leather/40"
      />

      {/* Lugar */}
      <div className="rounded-2xl border border-ink/10 bg-card/60 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setPlaceOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-ink"
        >
          <MapPin className="h-4 w-4" strokeWidth={1.75} />
          {place ? place.name : "Etiquetar lugar (mapa)"}
        </button>
        {place && (
          <button
            type="button"
            onClick={() => setPlace(null)}
            className="ml-2 text-xs text-clay hover:underline"
          >
            Quitar lugar
          </button>
        )}
        {placeOpen && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-full border border-ink/15 bg-card px-3 py-2">
              <Search className="h-3.5 w-3.5 text-ink/40" />
              <input
                value={placeTerm}
                onChange={(e) => setPlaceTerm(e.target.value)}
                placeholder="Busca un café, cine, ciudad…"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              {placeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/40" />}
            </div>
            {place && place.lat !== 0 && (
              <iframe
                title="mapa"
                className="w-full h-36 rounded-xl border border-ink/10"
                src={mapEmbedSrc(place.lat, place.lng)}
              />
            )}
            <ul className="max-h-40 overflow-y-auto divide-y divide-ink/5">
              {placeResults.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlace(r);
                      setPlaceTerm("");
                    }}
                    className="w-full text-left text-xs py-2 px-1 hover:bg-ink/5 rounded-lg"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
              {!placeLoading && placeTerm.trim().length >= 3 && placeResults.length === 0 && (
                <li className="text-xs text-ink/40 py-2">Sin resultados</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Personas */}
      <div className="rounded-2xl border border-ink/10 bg-card/60 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setPeopleOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-ink"
        >
          <AtSign className="h-4 w-4" strokeWidth={1.75} />
          Etiquetar amigos
        </button>

        {tagged.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagged.map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-1 rounded-full bg-clay/15 text-clay text-xs px-3 py-1"
              >
                @{u}
                <button type="button" onClick={() => setTagged(tagged.filter((x) => x !== u))} aria-label={`Quitar ${u}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {peopleOpen && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-full border border-ink/15 bg-card px-3 py-2">
              <Search className="h-3.5 w-3.5 text-ink/40" />
              <input
                value={peopleTerm}
                onChange={(e) => setPeopleTerm(e.target.value)}
                placeholder="Busca por nombre o @usuario"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
            <ul className="max-h-40 overflow-y-auto divide-y divide-ink/5">
              {peopleFiltered.map((p) => {
                const on = tagged.includes(p.username);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setTagged(on ? tagged.filter((x) => x !== p.username) : [...tagged, p.username])
                      }
                      className={`w-full flex items-center gap-2 text-left py-2 px-1 rounded-lg hover:bg-ink/5 ${on ? "opacity-60" : ""}`}
                    >
                      <span className="size-7 rounded-full overflow-hidden bg-leather/15 grid place-items-center text-[10px] font-semibold text-leather shrink-0">
                        {p.avatar_url ? (
                          <SmartImage path={p.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          p.display_name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="text-xs truncate">
                        {p.display_name} <span className="text-ink/40">@{p.username}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {friendsQ.isLoading && <li className="text-xs text-ink/40 py-2">Cargando…</li>}
              {!friendsQ.isLoading && peopleFiltered.length === 0 && (
                <li className="text-xs text-ink/40 py-2">Sin resultados</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink text-parchment px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold hover:bg-ink/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
