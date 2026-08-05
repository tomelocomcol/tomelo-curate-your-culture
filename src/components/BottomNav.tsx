import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Film, Home, User, Users } from "lucide-react";

const items = [
  { to: "/feed", label: "Feed", Icon: Home },
  { to: "/biblioteca", label: "Biblioteca", Icon: BookOpen },
  { to: "/cine", label: "Cine", Icon: Film },
  { to: "/amigos", label: "Amigos", Icon: Users },
  { to: "/perfil", label: "Perfil", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] bg-ink text-parchment rounded-2xl h-16 flex items-center justify-around px-4 shadow-2xl shadow-ink/20 z-50">
      {items.map(({ to, label, Icon }) => {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 px-3 py-1 group"
          >
            <Icon
              className={`h-5 w-5 transition-colors ${active ? "text-clay" : "text-parchment/50 group-hover:text-parchment"}`}
              strokeWidth={1.75}
            />
            <span
              className={`text-[9px] font-bold uppercase tracking-tight transition-colors ${active ? "text-clay" : "text-parchment/50 group-hover:text-parchment"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
