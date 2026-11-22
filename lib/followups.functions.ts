import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext } from "./authz";

export const listMyFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("follow_up_tasks")
      .select("id, title, due_date, recurrence, status, client_id, case_note_id")
      .eq("organization_id", ctx.organizationId)
      .eq("assigned_to", ctx.userId)
      .eq("status", "open")
      .order("due_date")
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function nextDate(d: string, rec: string) {
  const dt = new Date(`${d}T00:00:00Z`);
  if (rec === "weekly") dt.setUTCDate(dt.getUTCDate() + 7);
  else dt.setUTCMonth(dt.getUTCMonth() + 1);
  return dt.toISOString().slice(0, 10);
}

export const completeFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: task, error } = await context.supabase
      .from("follow_up_tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", ctx.organizationId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (task.recurrence !== "none") {
      await context.supabase.from("follow_up_tasks").insert({
        organization_id: task.organization_id,
        case_note_id: task.case_note_id,
        client_id: task.client_id,
        assigned_to: task.assigned_to,
        created_by: ctx.userId,
        title: task.title,
        due_date: nextDate(task.due_date, task.recurrence),
        recurrence: task.recurrence,
      });
    }
    await audit(context.supabase, ctx, "follow_up.completed", "follow_up_task", data.id);
    return { ok: true };
  });
