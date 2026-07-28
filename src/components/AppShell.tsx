import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  children,
  showSettings = false,
}: {
  title?: string;
  children: React.ReactNode;
  showSettings?: boolean;
}) {
  return (
    <div className="min-h-screen bg-parchment text-ink pb-32">
      <header className="sticky top-0 z-30 bg-parchment/85 backdrop-blur-md border-b border-ink/5 px-5 py-4 flex justify-between items-center">
        <Link
          to="/feed"
          className="font-serif italic text-2xl font-semibold text-leather"
        >
          Tomelo
        </Link>
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-[10px] uppercase tracking-widest text-ink/50">
              {title}
            </span>
          )}
          {showSettings && (
            <Link
              to="/ajustes"
              aria-label="Ajustes"
              className="p-1.5 rounded-full hover:bg-ink/5"
            >
              <Settings className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-[560px] mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
