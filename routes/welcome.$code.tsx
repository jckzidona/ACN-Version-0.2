import { useEffect, type CSSProperties } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getPublicBranding } from "@/lib/public-branding.functions";

export const Route = createFileRoute("/welcome/$code")({
  loader: async ({ params }) => {
    const branding = await getPublicBranding({ data: { code: params.code } });
    if (!branding) throw notFound();
    return branding;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.name ?? "Organization welcome"} — ACN — Assistance Case Note` },
    { name: "description", content: "Sign in to your organization's ACN — Assistance Case Note workspace." },
    { property: "og:title", content: `${loaderData?.name ?? "Organization welcome"} — ACN — Assistance Case Note` },
    { property: "og:description", content: "Your organization's secure ACN documentation workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    ...(loaderData?.backgroundUrl?.startsWith("https://") ? [
      { property: "og:image", content: loaderData.backgroundUrl },
      { name: "twitter:image", content: loaderData.backgroundUrl },
    ] : []),
  ] }),
  component: OrganizationWelcome,
});

function OrganizationWelcome() {
  const branding = Route.useLoaderData();
  const [primary, secondary, highlight] = branding.colors;

  useEffect(() => {
    const root = document.documentElement;
    if (primary) root.style.setProperty("--primary", primary);
    if (secondary) root.style.setProperty("--accent", secondary);
    if (highlight) root.style.setProperty("--ring", highlight);
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--ring");
    };
  }, [highlight, primary, secondary]);

  const style: CSSProperties = branding.backgroundUrl
    ? { backgroundImage: `linear-gradient(var(--background-overlay), var(--background-overlay)), url(${branding.backgroundUrl})` }
    : branding.backgroundColor
      ? { backgroundColor: branding.backgroundColor }
      : {};

  return (
    <div style={style} className="flex min-h-screen flex-col bg-background bg-cover bg-center">
      <header className="border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoUrl && <img src={branding.logoUrl} alt={`${branding.name} logo`} className="h-10 max-w-32 object-contain" />}
            <span className="truncate text-sm font-semibold text-foreground">{branding.name}</span>
          </div>
          <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main className="flex flex-1 items-center px-4 py-14 sm:px-6">
        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-background/92 p-6 shadow-lg backdrop-blur-sm sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">ACN — Assistance Case Note</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {branding.headline || `Welcome to ${branding.name}`}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            {branding.message || "A secure documentation workspace for your settlement and counselling team."}
          </p>
          <Button asChild size="lg" className="mt-8 min-h-12 w-full sm:w-auto"><Link to="/auth">Continue to sign in</Link></Button>
        </section>
      </main>
      <footer className="border-t border-border bg-background/90 px-4 py-5 text-center text-xs text-muted-foreground backdrop-blur-sm">
        © 2026 ACN — Assistance Case Note. All rights reserved.
      </footer>
    </div>
  );
}