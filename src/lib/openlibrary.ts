// Open Library search + cover helpers. No API key required.

export interface OpenLibraryBook {
  key: string; // "/works/OL..."
  title: string;
  author: string | null;
  cover_url: string | null;
  first_publish_year: number | null;
}

export async function searchBooks(query: string, limit = 12): Promise<OpenLibraryBook[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Búsqueda no disponible");
  const json = (await res.json()) as {
    docs: Array<{
      key: string;
      title: string;
      author_name?: string[];
      cover_i?: number;
      first_publish_year?: number;
    }>;
  };
  return json.docs.map((d) => ({
    key: d.key,
    title: d.title,
    author: d.author_name?.[0] ?? null,
    cover_url: d.cover_i
      ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
      : null,
    first_publish_year: d.first_publish_year ?? null,
  }));
}
