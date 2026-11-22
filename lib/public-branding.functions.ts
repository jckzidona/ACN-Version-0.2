import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Background =
  | { type: "default" }
  | { type: "color"; color: string }
  | { type: "url"; url: string }
  | { type: "upload"; path: string };

function parseBackground(value: unknown): Background {
  if (!value || typeof value !== "object") return { type: "default" };
  const item = value as Record<string, unknown>;
  if (item["type"] === "color" && typeof item["color"] === "string") return { type: "color", color: item["color"] };
  if (item["type"] === "url" && typeof item["url"] === "string" && item["url"].startsWith("https://")) {
    return { type: "url", url: item["url"] };
  }
  if (item["type"] === "upload" && typeof item["path"] === "string") return { type: "upload", path: item["path"] };
  return { type: "default" };
}

export const getPublicBranding = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{4,40}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: organization, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, logo_url, primary_color, secondary_color, settings")
      .eq("join_code", data.code.toUpperCase())
      .maybeSingle();

    if (error || !organization) return null;
    const settings = (organization.settings ?? {}) as Record<string, unknown>;
    const background = parseBackground(settings["publicBackground"]);
    let backgroundUrl: string | null = background.type === "url" ? background.url : null;

    if (background.type === "upload" && background.path.startsWith(`${organization.id}/`) && !background.path.includes("..")) {
      const { data: signed } = await supabaseAdmin.storage
        .from("organization-branding")
        .createSignedUrl(background.path, 3600);
      backgroundUrl = signed?.signedUrl ?? null;
    }

    const savedColors = settings["accentColors"];
    const colors = Array.isArray(savedColors)
      ? savedColors.filter((value): value is string => typeof value === "string").slice(0, 3)
      : [];

    return {
      name: organization.name,
      logoUrl: organization.logo_url,
      headline: typeof settings["welcomeHeadline"] === "string" ? settings["welcomeHeadline"] : null,
      message: typeof settings["welcomeMessage"] === "string" ? settings["welcomeMessage"] : null,
      colors: [colors[0] ?? organization.primary_color, colors[1] ?? organization.secondary_color, colors[2] ?? "#e9c46a"],
      backgroundColor: background.type === "color" ? background.color : null,
      backgroundUrl,
    };
  });