import { clearAllDrafts } from "@/hooks/useAutoDraft";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/MobileNav";
import {
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  BarChart3,
  UserCog,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/notes", label: "Case notes", icon: FileText },
  { to: "/notes/new", label: "New case note", icon: FilePlus2 },
  { to: "/groups", label: "Group sessions", icon: UsersRound },
  { to: "/profile", label: "My profile", icon: UserCog },
] as const;


const MANAGER_NAV = [
  { to: "/manager", label: "Staff management", icon: ShieldCheck },
  { to: "/organization-settings", label: "Organization settings", icon: Settings },
] as const;


export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [workspaceImage, setWorkspaceImage] = useState<string | null>(null);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearAllDrafts();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isManager =
    session?.roles.includes("manager") || session?.roles.includes("org_admin") || false;
  const isAdmin = session?.roles.includes("org_admin") || false;
  const { data: isOwner } = useQuery({
    queryKey: ["is-platform-owner", session?.userId],
    enabled: Boolean(session?.userId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_platform_owner", { _user_id: session!.userId });
      return Boolean(data);
    },
  });

  const awaitingApproval =
    session?.accountStatus === "inactive" ||
    session?.accountStatus === "archived" ||
    (Boolean(session?.organization) && (session?.accountStatus ?? "active") !== "active");

  const primaryNav = isManager
    ? NAV.map((item) =>
        item.to === "/dashboard"
          ? { ...item, to: "/reports" as const, label: "Reports & statistics", icon: BarChart3 }
          : item,
      )
    : NAV;

  const settings = (session?.organization?.settings ?? {}) as Record<string, unknown>;
  const workspaceBackground = settings["workspaceBackground"] as Record<string, unknown> | undefined;

  useEffect(() => {
    const type = workspaceBackground?.["type"];
    if (type === "url" && typeof workspaceBackground?.["url"] === "string") {
      setWorkspaceImage(workspaceBackground["url"] as string);
      return;
    }
    if (type === "upload" && typeof workspaceBackground?.["path"] === "string") {
      void supabase.storage
        .from("organization-branding")
        .createSignedUrl(workspaceBackground["path"] as string, 3600)
        .then(({ data }) => setWorkspaceImage(data?.signedUrl ?? null));
      return;
    }
    setWorkspaceImage(null);
  }, [workspaceBackground?.["path"], workspaceBackground?.["type"], workspaceBackground?.["url"]]);

  const workspaceStyle: CSSProperties | undefined = workspaceImage
    ? { backgroundImage: `linear-gradient(var(--background-overlay), var(--background-overlay)), url(${workspaceImage})` }
    : workspaceBackground?.["type"] === "color" && typeof workspaceBackground?.["color"] === "string"
      ? { backgroundColor: workspaceBackground["color"] as string }
      : undefined;

  if (awaitingApproval) {
    const pending = session?.accountStatus === "pending";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-panel)]">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {pending ? "Waiting for approval" : "Account not active"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pending
              ? "An admin or manager at your organization needs to approve your account before you can use the app. You will be able to sign in as soon as they do."
              : "Your account has been deactivated or archived. Ask an admin or manager to reactivate it."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Signed in as {session?.email ?? session?.fullName}
          </p>
          <Button variant="outline" className="mt-5 min-h-[44px] w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {[
        ...primaryNav,
        ...(isManager ? MANAGER_NAV.filter((item) => item.to !== "/manager" || isAdmin) : []),
        ...(isOwner ? [{ to: "/demo-requests" as const, label: "Demo requests", icon: Inbox }] : []),
      ].map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === to
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div style={workspaceStyle} className="min-h-screen bg-background bg-cover bg-center bg-fixed pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div>
          <div className="px-3 py-2">
            {session?.organization?.logo_url && (
              <img
                src={session.organization.logo_url}
                alt={`${session.organization.name} logo`}
                className="mb-2 h-8 w-auto object-contain"
              />
            )}
            <p className="text-sm font-semibold text-sidebar-foreground">
              {session?.organization?.name ?? "ACN — Assistance Case Note"}
            </p>

            <p className="text-xs text-sidebar-foreground/60">
              {session?.department?.name ?? "No department"}
            </p>
          </div>
          <div className="mt-4">{nav}</div>
        </div>
        <div className="border-t border-sidebar-border pt-3">
          <p className="px-3 text-sm text-sidebar-foreground">{session?.fullName}</p>
          <p className="px-3 text-xs text-sidebar-foreground/60">{session?.email}</p>
          <button
            onClick={signOut}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 lg:hidden"
                aria-label="Toggle navigation"
                onClick={() => setOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                {description && (
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {open && (
            <div className="border-t border-border bg-sidebar px-4 py-3 lg:hidden">
              {nav}
              <button
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm text-sidebar-foreground/80"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </header>
        <main className="min-w-0 flex-1 bg-background/90 px-4 py-4 backdrop-blur-[1px] lg:px-5 lg:py-6">{children}</main>
      </div>

      <MobileNav isManager={isManager} />
    </div>
  );
}
