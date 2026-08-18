import { useEffect, useState } from "react";

export type PlaceHit = { name: string; lat: number; lng: number };

export function usePlaceSearch(term: string) {
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" } },
        );
        const json = (await res.json()) as Array<{
          display_name: string;
          name?: string;
          lat: string;
          lon: string;
        }>;
        if (!alive) return;
        setResults(
          json.map((r) => ({
            name:
              r.name && r.name.length > 0
                ? `${r.name} · ${r.display_name.split(",").slice(1, 3).join(",").trim()}`
                : r.display_name,
            lat: Number(r.lat),
            lng: Number(r.lon),
          })),
        );
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
      setLoading(false);
    };
  }, [term]);

  return { results, loading };
}

export function mapEmbedSrc(lat: number, lng: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.004}%2C${lng + 0.005}%2C${lat + 0.004}&layer=mapnik&marker=${lat}%2C${lng}`;
}
