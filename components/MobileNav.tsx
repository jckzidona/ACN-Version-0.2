import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Users,
  UserCog,
} from "lucide-react";

const BASE = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/notes/new", label: "New note", icon: FilePlus2 },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/profile", label: "Profile", icon: UserCog },
] as const;

export function MobileNav({ isManager }: { isManager: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = isManager
    ? BASE.map((i) =>
        i.to === "/dashboard"
          ? { ...i, to: "/reports" as const, label: "Reports" as const, icon: BarChart3 }
          : i,
      )
    : BASE;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-center justify-around px-1 pt-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors min-h-[56px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
