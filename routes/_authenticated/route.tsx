import { useEffect } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

const BRAND_VARS = ["--primary", "--ring", "--accent", "--sidebar-primary"] as const;

function AuthenticatedLayout() {
  const { data: session } = useSession();

  useEffect(() => {
    const root = document.documentElement;
    const org = session?.organization;
    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const saved = settings["accentColors"];
    const colors = Array.isArray(saved)
      ? saved.filter((c): c is string => typeof c === "string")
      : [];

    const [c1, c2, c3] = [
      colors[0] ?? org?.primary_color,
      colors[1] ?? (org as { secondary_color?: string | null } | null)?.secondary_color,
      colors[2],
    ];

    if (c1) {
      root.style.setProperty("--primary", c1);
      root.style.setProperty("--ring", c1);
    }
    if (c2) root.style.setProperty("--accent", c2);
    if (c3) root.style.setProperty("--sidebar-primary", c3);

    return () => {
      for (const v of BRAND_VARS) root.style.removeProperty(v);
    };
  }, [session?.organization]);

  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});
