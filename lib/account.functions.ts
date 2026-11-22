import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Puts the caller's own account back into "pending" after a password reset.
 * An admin or manager must approve it again before they can use the app.
 */
export const requireApprovalAfterReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id, department_id, full_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.organization_id) return { ok: true, pending: false };

    // Organization admins are the approvers — never lock them out waiting for approval.
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", profile.organization_id)
      .eq("role", "org_admin")
      .maybeSingle();
    if (adminRole) {
      await supabaseAdmin.from("audit_logs").insert({
        organization_id: profile.organization_id,
        user_id: context.userId,
        department_id: profile.department_id,
        action: "user.password_reset",
        entity_type: "profile",
        entity_id: context.userId,
        metadata: { name: profile.full_name } as never,
      });
      return { ok: true, pending: false };
    }

    await supabaseAdmin.from("profiles").update({ status: "pending" }).eq("id", context.userId);

    await supabaseAdmin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: context.userId,
      department_id: profile.department_id,
      action: "user.password_reset_pending_approval",
      entity_type: "profile",
      entity_id: context.userId,
      metadata: { name: profile.full_name } as never,
    });

    return { ok: true, pending: true };
  });
