import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext, requireAdmin, requireManager, type AppRole } from "./authz";

const backgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("default") }),
  z.object({ type: z.literal("color"), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({ type: z.literal("url"), url: z.string().url().refine((url) => url.startsWith("https://"), "Use an HTTPS image link.") }),
  z.object({ type: z.literal("upload"), path: z.string().min(3).max(500) }),
]);

/** Staff directory. Organization admins only (CARMiS-style: user management is an admin right). */
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireAdmin(ctx);

    const [{ data: people }, { data: roles }, { data: departments }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, job_title, department_id, status, created_at")
        .eq("organization_id", ctx.organizationId)
        .order("full_name"),
      context.supabase.from("user_roles").select("user_id, role").eq("organization_id", ctx.organizationId),
      context.supabase.from("departments").select("id, name").eq("organization_id", ctx.organizationId),
    ]);

    const deptNames = new Map((departments ?? []).map((d) => [d.id, d.name]));

    return {
      canManageRoles: ctx.isAdmin,
      selfId: ctx.userId,
      members: (people ?? []).map((p) => ({
        id: p.id,
        fullName: p.full_name || "Unnamed staff member",
        email: p.email,
        jobTitle: p.job_title,
        status: p.status,
        department: p.department_id ? (deptNames.get(p.department_id) ?? "—") : "—",
        departmentId: p.department_id,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      })),
    };
  });

/** Replaces a member's role within the organization. Organization admins only. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["worker", "manager", "org_admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireAdmin(ctx);
    if (data.userId === ctx.userId) {
      throw new Error("You cannot change your own role.");
    }

    const { error: delError } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("organization_id", ctx.organizationId);
    if (delError) throw new Error(delError.message);

    const { error } = await context.supabase.from("user_roles").insert({
      user_id: data.userId,
      organization_id: ctx.organizationId,
      role: data.role,
    });
    if (error) throw new Error(error.message);

    await audit(context.supabase, ctx, "user.role_changed", "profile", data.userId, {
      role: data.role,
    });
    return { ok: true };
  });

/** Organization identity and branding. Managers and org admins. */
export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        legalName: z.string().max(160).nullable().optional(),
        logoUrl: z.string().url().max(500).nullable().optional(),
        primaryColor: z.string().max(32).optional(),
        accentColors: z.array(z.string().max(32)).min(3).max(6).optional(),
        welcomeHeadline: z.string().max(120).nullable().optional(),
        welcomeMessage: z.string().max(400).nullable().optional(),
        timezone: z.string().max(80).optional(),
        contactEmail: z.string().email().nullable().optional(),
        contactPhone: z.string().max(60).nullable().optional(),
        address: z.string().max(300).nullable().optional(),
        publicBackground: backgroundSchema.optional(),
        workspaceBackground: backgroundSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);

    const { data: current } = await context.supabase
      .from("organizations")
      .select("settings")
      .eq("id", ctx.organizationId)
      .maybeSingle();

    const accentColors = data.accentColors?.length
      ? data.accentColors
      : data.primaryColor
        ? [data.primaryColor]
        : undefined;

    const settings = {
      ...((current?.settings as Record<string, unknown>) ?? {}),
      welcomeHeadline: data.welcomeHeadline?.trim() || null,
      welcomeMessage: data.welcomeMessage?.trim() || null,
      ...(data.publicBackground ? { publicBackground: data.publicBackground } : {}),
      ...(data.workspaceBackground ? { workspaceBackground: data.workspaceBackground } : {}),
      ...(accentColors ? { accentColors } : {}),
      contactEmail: data.contactEmail?.trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
      address: data.address?.trim() || null,
    };

    const { error } = await context.supabase
      .from("organizations")
      .update({
        name: data.name.trim(),
        legal_name: data.legalName?.trim() || null,
        logo_url: data.logoUrl?.trim() || null,
        ...(accentColors?.[0] ? { primary_color: accentColors[0] } : {}),
        ...(accentColors?.[1] ? { secondary_color: accentColors[1] } : {}),
        settings: settings as never,
        timezone: data.timezone || "UTC",
      })
      .eq("id", ctx.organizationId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, ctx, "organization.updated", "organization", ctx.organizationId, {
      name: data.name,
    });
    return { ok: true };
  });

async function assertDepartmentInOrg(admin: { from: (t: "departments") => any }, departmentId: string | null | undefined, organizationId: string) {
  if (!departmentId) return;
  const { data } = await admin.from("departments").select("id").eq("id", departmentId).eq("organization_id", organizationId).maybeSingle();
  if (!data) throw new Error("Select a department that belongs to your organization.");
}

/** Updates a colleague's profile details. Organization admins only. */
export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().min(1).max(120),
        jobTitle: z.string().max(120).nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        status: z.enum(["pending", "active", "inactive", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireAdmin(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.organization_id !== ctx.organizationId) {
      throw new Error("That staff member is not part of your organization.");
    }
    await assertDepartmentInOrg(supabaseAdmin, data.departmentId, ctx.organizationId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName.trim(),
        job_title: data.jobTitle?.trim() || null,
        department_id: data.departmentId ?? null,
        status: data.status,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, ctx, "user.updated", "profile", data.userId, {
      status: data.status,
    });
    return { ok: true };
  });

/** Deactivates or archives a staff account. Accounts are never deleted so records stay intact. */
export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["pending", "active", "inactive", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireAdmin(ctx);
    if (data.userId === ctx.userId) {
      throw new Error("You cannot change your own account status.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id, full_name")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.organization_id !== ctx.organizationId) {
      throw new Error("That staff member is not part of your organization.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, ctx, `user.${data.status}`, "profile", data.userId, {
      name: target.full_name,
      status: data.status,
    });
    return { ok: true };
  });


/** Invites a new worker by email and attaches them to the organization. Organization admins only. */
export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(2).max(120),
        jobTitle: z.string().max(120).nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        role: z.enum(["worker", "manager"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireAdmin(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertDepartmentInOrg(supabaseAdmin, data.departmentId, ctx.organizationId);
    const email = data.email.trim().toLowerCase();

    // Create (or look up) the auth account, then send an invite email.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: data.fullName.trim() },
    });

    let userId: string | null = created.user?.id ?? null;

    if (createError) {
      // Account may already exist — look it up.
      const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw new Error(listError.message);
      const existing = listed.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error(createError.message);
      userId = existing.id;
    }

    if (!userId) throw new Error("Could not create the staff account.");

    // Refuse if the account already belongs to another organization.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfile?.organization_id && existingProfile.organization_id !== ctx.organizationId) {
      throw new Error("That email belongs to an account in another organization.");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.fullName.trim(),
        email,
        job_title: data.jobTitle?.trim() || null,
        organization_id: ctx.organizationId,
        department_id: data.departmentId ?? null,
        status: "active",
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      organization_id: ctx.organizationId,
      role: data.role,
    });
    if (roleError) throw new Error(roleError.message);

    // Send the invite so the person can set a password and sign in.
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError && !createError) {
      // Invite failed for a freshly created account is a real problem.
      throw new Error(inviteError.message);
    }

    await audit(context.supabase, ctx, "user.added", "profile", userId, {
      email,
      role: data.role,
    });
    return { ok: true, userId };
  });
