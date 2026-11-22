import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, loadContext, requireAdmin, requireManager } from "./authz";

const optionalUuid = z.string().uuid().nullable().optional();

export const getOrganizationConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const sb = context.supabase;
    const [organization, departments, programs, activities, funders, programFunders, activityPrograms, referrals, templates, statuses] = await Promise.all([
      sb.from("organizations").select("id, name, legal_name, logo_url, primary_color, secondary_color, timezone, settings, join_code").eq("id", ctx.organizationId).single(),
      sb.from("departments").select("id, name, description, status").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("programs").select("id, department_id, name, category, description, eligibility, location, schedule, languages, registration_required, capacity, contact_information, active, note_type, visible_roles, default_roles").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("service_activities").select("id, name, description, client_facing, applicable_to, active").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("organization_funders").select("id, name, description, reporting_designation, submits_funder_report, active").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("program_funders").select("program_id, funder_id").eq("organization_id", ctx.organizationId),
      sb.from("activity_programs").select("activity_id, program_id").eq("organization_id", ctx.organizationId),
      sb.from("referral_partners").select("id, name, partner_type, program_id, contact_information, notes, active").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("note_templates").select("id, department_id, name, sections, ai_instructions, is_default, active").eq("organization_id", ctx.organizationId).order("name"),
      sb.from("immigration_status_options").select("id, name, description, active, system_defined").eq("organization_id", ctx.organizationId).order("name"),
    ]);
    const failed = [organization, departments, programs, activities, funders, programFunders, activityPrograms, referrals, templates, statuses].find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    return {
      canEdit: ctx.isAdmin,
      organization: organization.data,
      departments: departments.data ?? [], programs: programs.data ?? [], activities: activities.data ?? [],
      funders: funders.data ?? [], programFunders: programFunders.data ?? [], activityPrograms: activityPrograms.data ?? [],
      referrals: referrals.data ?? [], templates: templates.data ?? [], statuses: statuses.data ?? [],
    };
  });

export const saveDepartment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).nullable().optional(), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx);
    const values = { organization_id: ctx.organizationId, name: data.name, description: data.description || null, status: data.active ? "active" : "inactive" };
    const result = data.id ? await context.supabase.from("departments").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("departments").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message); await audit(context.supabase, ctx, "configuration.department_saved", "department", result.data.id); return result.data;
  });

export const saveProgram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(160), departmentId: optionalUuid, category: z.string().trim().max(100), description: z.string().trim().max(1000), location: z.string().trim().max(200).nullable().optional(), languages: z.array(z.string().trim().min(1)).max(20), capacity: z.number().int().positive().nullable().optional(), registrationRequired: z.boolean(), noteType: z.enum(["case_notes", "group_sessions", "both"]), visibleRoles: z.array(z.enum(["worker", "manager", "org_admin"])), defaultRoles: z.array(z.enum(["worker", "manager", "org_admin"])), funderIds: z.array(z.string().uuid()), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx);
    const values = { organization_id: ctx.organizationId, name: data.name, department_id: data.departmentId ?? null, category: data.category || "Settlement services", description: data.description, location: data.location || null, languages: data.languages.length ? data.languages : ["English"], capacity: data.capacity ?? null, registration_required: data.registrationRequired, note_type: data.noteType, visible_roles: data.visibleRoles, default_roles: data.defaultRoles, active: data.active };
    const result = data.id ? await context.supabase.from("programs").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("programs").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await context.supabase.from("program_funders").delete().eq("program_id", result.data.id).eq("organization_id", ctx.organizationId);
    if (data.funderIds.length) { const linked = await context.supabase.from("program_funders").insert(data.funderIds.map((funder_id) => ({ program_id: result.data.id, funder_id, organization_id: ctx.organizationId }))); if (linked.error) throw new Error(linked.error.message); }
    await audit(context.supabase, ctx, "configuration.program_saved", "program", result.data.id); return result.data;
  });

export const saveActivity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(160), description: z.string().trim().max(500).nullable().optional(), clientFacing: z.boolean(), applicableTo: z.enum(["case_notes", "group_sessions", "both"]), programIds: z.array(z.string().uuid()), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx);
    const values = { organization_id: ctx.organizationId, name: data.name, description: data.description || null, client_facing: data.clientFacing, applicable_to: data.applicableTo, active: data.active };
    const result = data.id ? await context.supabase.from("service_activities").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("service_activities").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await context.supabase.from("activity_programs").delete().eq("activity_id", result.data.id).eq("organization_id", ctx.organizationId);
    if (data.programIds.length) { const linked = await context.supabase.from("activity_programs").insert(data.programIds.map((program_id) => ({ activity_id: result.data.id, program_id, organization_id: ctx.organizationId }))); if (linked.error) throw new Error(linked.error.message); }
    await audit(context.supabase, ctx, "configuration.activity_saved", "service_activity", result.data.id); return result.data;
  });

export const saveFunder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(160), description: z.string().trim().max(500).nullable().optional(), reportingDesignation: z.string().trim().max(120).nullable().optional(), submitsReport: z.boolean(), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx); const values = { organization_id: ctx.organizationId, name: data.name, description: data.description || null, reporting_designation: data.reportingDesignation || null, submits_funder_report: data.submitsReport, active: data.active };
    const result = data.id ? await context.supabase.from("organization_funders").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("organization_funders").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message); await audit(context.supabase, ctx, "configuration.funder_saved", "organization_funder", result.data.id); return result.data;
  });

export const saveReferralPartner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(160), partnerType: z.enum(["internal", "external"]), programId: optionalUuid, contactInformation: z.string().trim().max(500).nullable().optional(), notes: z.string().trim().max(500).nullable().optional(), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx); const values = { organization_id: ctx.organizationId, name: data.name, partner_type: data.partnerType, program_id: data.programId ?? null, contact_information: data.contactInformation || null, notes: data.notes || null, active: data.active };
    const result = data.id ? await context.supabase.from("referral_partners").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("referral_partners").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message); await audit(context.supabase, ctx, "configuration.referral_partner_saved", "referral_partner", result.data.id); return result.data;
  });

export const saveImmigrationStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).nullable().optional(), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx); const values = { organization_id: ctx.organizationId, name: data.name, description: data.description || null, active: data.active };
    const result = data.id ? await context.supabase.from("immigration_status_options").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("immigration_status_options").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message); await audit(context.supabase, ctx, "configuration.immigration_status_saved", "immigration_status", result.data.id); return result.data;
  });

export const saveTemplate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: optionalUuid, name: z.string().trim().min(2).max(160), departmentId: z.string().uuid(), aiInstructions: z.string().trim().max(3000), isDefault: z.boolean(), active: z.boolean() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId); requireAdmin(ctx);
    const { data: dept } = await context.supabase.from("departments").select("name").eq("id", data.departmentId).eq("organization_id", ctx.organizationId).single();
    const counselling = /counsel/i.test(dept?.name ?? "");
    const sections = counselling ? ["Subjective", "Objective", "Assessment", "Plan"] : ["Case Note", "Client's Success", "Client's Challenge", "Follow-Up / Next Steps"];
    const guardrail = counselling ? " Follow SOAP rules. Never invent facts or diagnoses." : " Never invent facts. Keep the required four-section settlement structure.";
    const values = { organization_id: ctx.organizationId, department_id: data.departmentId, name: data.name, sections, ai_instructions: `${data.aiInstructions}${guardrail}`.trim(), is_default: data.isDefault, active: data.active };
    if (data.isDefault) await context.supabase.from("note_templates").update({ is_default: false }).eq("organization_id", ctx.organizationId).eq("department_id", data.departmentId);
    const result = data.id ? await context.supabase.from("note_templates").update(values).eq("id", data.id).eq("organization_id", ctx.organizationId).select("id").single() : await context.supabase.from("note_templates").insert(values).select("id").single();
    if (result.error) throw new Error(result.error.message); await audit(context.supabase, ctx, "configuration.template_saved", "note_template", result.data.id); return result.data;
  });