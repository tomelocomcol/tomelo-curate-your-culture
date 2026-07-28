import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

export function SmartImage({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSignedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) {
    return <div className={`bg-leather/10 ${className ?? ""}`} aria-label={alt} />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
