import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { AppRole, SessionSnapshot } from "./authz";

const DEFAULT_TEMPLATE_SECTIONS = [
  "Case Note",
  "Client's Success",
  "Client's Challenge",
  "Follow-Up / Next Steps",
];

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionSnapshot> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, job_title, phone, status, organization_id, department_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);

    let organization: SessionSnapshot["organization"] = null;
    let department: SessionSnapshot["department"] = null;

    const [orgRes, deptRes] = await Promise.all([
      profile?.organization_id
        ? supabase
            .from("organizations")
            .select("id, name, join_code, logo_url, primary_color, secondary_color, settings")
            .eq("id", profile.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      profile?.department_id
        ? supabase
            .from("departments")
            .select("id, name")
            .eq("id", profile.department_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const org = orgRes.data;
    if (org)
      organization = {
        ...org,
        settings: (org.settings ?? {}) as NonNullable<SessionSnapshot["organization"]>["settings"],
      };
    department = deptRes.data ?? null;

    return {
      userId,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? "",
      jobTitle: profile?.job_title ?? null,
      phone: profile?.phone ?? null,
      roles,
      organization,
      department,
      // Org admins oversee every department, so they don't need one assigned.
      onboarded: Boolean(
        profile?.organization_id && (profile?.department_id || roles.includes("org_admin")),
      ),
      accountStatus: profile?.status ?? "pending",
    };
  });

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("departments")
      .select("id, name, description, status")
      .order("name");
    return data ?? [];
  });

export const lookupOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ joinCode: z.string().min(4) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("join_code", data.joinCode.trim().toUpperCase())
      .maybeSingle();
    if (!org) return null;
    const { data: depts } = await supabaseAdmin
      .from("departments")
      .select("id, name")
      .eq("organization_id", org.id)
      .eq("status", "active")
      .order("name");
    return { id: org.id, name: org.name, departments: depts ?? [] };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        fullName: z.string().min(2).max(120),
        jobTitle: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.organization_id) throw new Error("You already belong to an organization.");

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.name, join_code: randomCode() })
      .select("id, join_code")
      .single();
    if (orgError || !org) throw new Error(orgError?.message ?? "Could not create the organization.");

    const { data: depts, error: deptError } = await supabaseAdmin
      .from("departments")
      .insert([
        { organization_id: org.id, name: "Settlement Services" },
        { organization_id: org.id, name: "Counselling Services" },
      ])
      .select("id, name");
    if (deptError) throw new Error(deptError.message);

    await supabaseAdmin.from("note_templates").insert(
      (depts ?? []).map((d) => ({
        organization_id: org.id,
        department_id: d.id,
        name: `${d.name} standard case note`,
        sections: DEFAULT_TEMPLATE_SECTIONS as never,
        is_default: true,
        ai_instructions:
          d.name === "Counselling Services"
            ? "Use neutral, non-clinical language. Never infer or state a diagnosis, mental-health condition, or clinical impression."
            : "Use plain professional settlement-services language. Refer to services, referrals and resources only when the worker described them.",
      })),
    );

    const firstDept = depts?.[0]?.id ?? null;
    await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: org.id,
        department_id: firstDept,
        full_name: data.fullName,
        job_title: data.jobTitle ?? null,
        status: "active",
      })
      .eq("id", userId);

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        [{ user_id: userId, organization_id: org.id, role: "org_admin" as const }],
        { onConflict: "user_id,role" },
      );

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: org.id,
      user_id: userId,
      action: "organization.created",
      entity_type: "organization",
      entity_id: org.id,
      metadata: { name: data.name } as never,
    });

    return { organizationId: org.id, joinCode: org.join_code };
  });

export const joinOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        joinCode: z.string().min(4),
        departmentId: z.string().uuid(),
        fullName: z.string().min(2).max(120),
        jobTitle: z.string().max(120).optional(),
        // Ignored: everyone joins as a worker; only an org admin can promote them.
        role: z.enum(["worker", "manager"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("join_code", data.joinCode.trim().toUpperCase())
      .maybeSingle();
    if (!org) throw new Error("That organization code was not recognised.");

    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("id", data.departmentId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (!dept) throw new Error("Select a department that belongs to this organization.");

    await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: org.id,
        department_id: dept.id,
        full_name: data.fullName,
        job_title: data.jobTitle ?? null,
        status: "pending",
      })
      .eq("id", userId);

    await supabaseAdmin
      .from("user_roles")
      .upsert([{ user_id: userId, organization_id: org.id, role: "worker" as const }], {
        onConflict: "user_id,role",
      });

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: org.id,
      user_id: userId,
      department_id: dept.id,
      action: "user.joined_organization",
      entity_type: "profile",
      entity_id: userId,
    });

    return { organizationId: org.id };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().min(2).max(120),
        jobTitle: z.string().max(120).nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "org_admin")
      .maybeSingle();
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        job_title: data.jobTitle ?? null,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        ...(adminRow && data.departmentId ? { department_id: data.departmentId } : {}),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
