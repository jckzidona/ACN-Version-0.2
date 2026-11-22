import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Db = SupabaseClient<Database>;

export interface WorkContext {
  userId: string;
  organizationId: string;
  departmentId: string | null;
  fullName: string;
  roles: AppRole[];
  isManager: boolean;
  isAdmin: boolean;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface SessionSnapshot {
  userId: string;
  email: string | null;
  fullName: string;
  jobTitle: string | null;
  phone: string | null;
  roles: AppRole[];
  organization: {
    id: string;
    name: string;
    join_code: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    settings: Record<string, JsonValue>;
  } | null;
  department: { id: string; name: string } | null;
  onboarded: boolean;
  /** active | pending | inactive | archived — pending/inactive/archived cannot use the app. */
  accountStatus: string;
}

/** Loads the caller's tenant context. Throws when the account is not attached to an organization. */
export async function loadContext(supabase: Db, userId: string): Promise<WorkContext> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id, department_id, full_name, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.organization_id) {
    throw new Error("Your account is not attached to an organization yet.");
  }
  if (profile.status && profile.status !== "active") {
    throw new Error(
      profile.status === "pending"
        ? "Your account is waiting for approval from an admin or manager."
        : "Your account is not active. Ask an admin or manager to reactivate it.",
    );
  }

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r) => r.role as AppRole);

  return {
    userId,
    organizationId: profile.organization_id,
    departmentId: profile.department_id,
    fullName: profile.full_name,
    roles,
    isManager: roles.includes("manager") || roles.includes("org_admin"),
    isAdmin: roles.includes("org_admin"),
  };
}

export function isManager(roles: AppRole[]) {
  return roles.includes("manager") || roles.includes("org_admin");
}

export function isAdmin(roles: AppRole[]) {
  return roles.includes("org_admin");
}

export function requireAdmin(ctx: WorkContext) {
  if (!ctx.isAdmin) throw new Error("You do not have permission to perform this action.");
}

export function requireManager(ctx: WorkContext) {
  if (!ctx.isManager) throw new Error("You do not have permission to view this information.");
}

/**
 * Department a report/list may cover. Org admins may pick any department (or all = null);
 * everyone else is locked to their own department, whatever the client requested.
 */
export function scopedDepartment(ctx: WorkContext, requested: string | null | undefined): string | null {
  if (ctx.isAdmin) return requested ?? null;
  if (!ctx.departmentId) {
    throw new Error("Your account has no department yet. Ask your organization admin to assign one.");
  }
  return ctx.departmentId;
}

/** Best-effort audit trail. Never blocks the caller's action. */
export async function audit(
  supabase: Db,
  ctx: WorkContext,
  action: string,
  entityType?: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("audit_logs").insert({
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      department_id: ctx.departmentId,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      metadata: metadata as never,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

export const INTERACTION_TYPES = [
  "Email",
  "Home visit",
  "Off-Site",
  "Office",
  "Phone",
  "Text/WhatsApp",
  "Virtual",
] as const;
