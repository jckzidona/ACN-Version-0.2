import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sharedClientRows } from "./shared-clients";
import { audit, loadContext } from "./authz";
import { AIProviderError, resolveProvider } from "./ai-provider";

const GUARDRAILS = `You are a documentation assistant for social-service and settlement organizations.
You convert a worker's raw notes into a professional, objective English case note.

Absolute rules:
- Use ONLY information the worker provided. Never invent facts, events, services, referrals, outcomes, dates, names or quotations.
- Never add a diagnosis, clinical impression, assessment, eligibility determination, legal or immigration advice.
- Never add recommendations the worker did not state.
- Do not change the meaning of the worker's information or add detail from any other client.
- If a section has no supporting information, write "Not documented." for that section.
- Write in plain, neutral, professional English in the third person ("The worker...", "The client...").
- Keep it concise and factual. No speculation, no emotive language, no headings other than the ones requested.`;

const SOAP_RULES = `This is a Counselling note in SOAP format (Cameron & turtle-song, 2002):
- Subjective: what the client (or pertinent others) reported — feelings, concerns, plans, goals, thoughts, intensity of problems and impact on relationships, verbalized changes. If the worker described the client's appearance or emotional state (e.g. sad, frustrated, anxious), include that description here. Keep quotes to a minimum.
- Objective: only what the worker personally observed or measured — affect, behaviour, nature of the helping relationship, demonstrated strengths and weaknesses, outside materials received.
- Assessment: restate ONLY the worker's own stated clinical thinking or impressions. Never create a diagnosis or impression yourself. If the worker gave none, write "Not documented."
- Plan: interventions used, progress, direction, date of next appointment and anticipated gains — only as stated by the worker.
- Start the note with the session date. Be brief, concise, active voice, precise descriptive terms.
- Avoid names of other clients, family members or others named by the client (use roles, e.g. "the client's sibling").
- Avoid "seems" and "appears", value-laden language, common labels, and opinionated statements.`;

export const generateCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        interactionType: z.string().min(1).max(80),
        interactionDate: z.string().min(4).max(20),
        rawInput: z.string().min(10).max(20000),
        caseNoteId: z.string().uuid().nullable().optional(),
        regenerate: z.boolean().optional(),
        appearance: z.string().max(40).nullable().optional(),
        appearanceNote: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const departmentId = ctx.isAdmin ? (data.departmentId ?? ctx.departmentId) : ctx.departmentId;
    const operation = data.regenerate ? "regeneration" : "generation";

    const [{ data: org }, { data: template }, { data: dept }] = await Promise.all([
      context.supabase
        .from("organizations")
        .select("name, settings")
        .eq("id", ctx.organizationId)
        .maybeSingle(),
      context.supabase
        .from("note_templates")
        .select("name, sections, ai_instructions")
        .eq("organization_id", ctx.organizationId)
        .eq("active", true)
        .eq("department_id", departmentId ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
      departmentId
        ? context.supabase.from("departments").select("name").eq("id", departmentId).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ]);
    const isCounselling = /counsel/i.test(dept?.name ?? "");

    const sections = isCounselling
      ? ["Subjective", "Objective", "Assessment", "Plan"]
      : [
          "Case Note",
          "Client's Success",
          "Client's Challenge",
          "Follow-Up / Next Steps",
        ];

    let clientLabel = "Not documented.";
    if (data.clientId) {
      const client = (await sharedClientRows(context.supabase)).find((r) => r.id === data.clientId);
      if (!client) throw new Error("Client not found.");
      if (client) clientLabel = `${client.first_name} ${client.last_name} (${client.client_identifier})`;
    }

    const systemPrompt = [
      GUARDRAILS,
      isCounselling ? SOAP_RULES : "",
      !isCounselling && template?.ai_instructions ? `Organization instructions: ${template.ai_instructions}` : "",
      `Produce the note using exactly these sections, each on its own line as "## <section name>":\n${sections.map((s) => `- ${s}`).join("\n")}`,
      `If the worker's raw account describes the client's appearance, demeanour or emotional state (e.g. sad, frustrated, anxious, well-groomed), weave that description into the ${isCounselling ? "Subjective" : "Case Note"} section using only what the worker stated. Do not infer or invent observations, and do not create a separate Appearance section.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = [
      `Organization: ${org?.name ?? "Not documented."}`,
      `Department: ${dept?.name ?? "Not documented."}`,
      `Worker: ${ctx.fullName}`,
      `Client: ${clientLabel}`,
      `Interaction type: ${data.interactionType}`,
      `Interaction date: ${data.interactionDate}`,
      "",
      "Worker's raw account of the interaction:",
      data.rawInput,
    ].join("\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this deployment.");

    const provider = resolveProvider({
      apiKey,
      provider: (org?.settings as { ai_provider?: string } | null)?.ai_provider,
      model: (org?.settings as { ai_model?: string } | null)?.ai_model,
    });

    try {
      const result = await provider.generate({ systemPrompt, userPrompt });
      await context.supabase.from("ai_generation_logs").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        department_id: departmentId,
        case_note_id: data.caseNoteId ?? null,
        provider: result.provider,
        model: result.model,
        operation,
        status: "success",
      });
      await audit(context.supabase, ctx, "ai.generation_requested", "case_note", data.caseNoteId ?? null, {
        operation,
      });
      return { text: result.text };
    } catch (err) {
      const message = err instanceof AIProviderError ? err.message : "AI generation failed.";
      await context.supabase.from("ai_generation_logs").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        department_id: departmentId,
        case_note_id: data.caseNoteId ?? null,
        provider: provider.name,
        model: provider.model,
        operation,
        status: "error",
        error_message: message.slice(0, 500),
      });
      throw new Error(message);
    }
  });

export const generateDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ date: z.string().min(4).max(20) }).parse(input ?? { date: "" }),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    if (!ctx.isManager) throw new Error("Only managers can generate activity summaries.");

    const day = data.date || new Date().toISOString().slice(0, 10);
    const { data: notes } = await context.supabase
      .from("case_notes")
      .select("id, status, department_id, author_id, deleted_at")
      .eq("organization_id", ctx.organizationId)
      .gte("created_at", `${day}T00:00:00Z`)
      .lte("created_at", `${day}T23:59:59Z`);

    const { data: drafts } = await context.supabase
      .from("drafts")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("status", "open");

    const scopeDept = ctx.isAdmin ? null : ctx.departmentId;
    const { data: departments } = await context.supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", ctx.organizationId);

    const deptCounts = (departments ?? []).filter((d) => !scopeDept || d.id === scopeDept).map((d) => ({
      name: d.name,
      notes: (notes ?? []).filter((n) => n.department_id === d.id).length,
    }));
    const staff = new Set((notes ?? []).map((n) => n.author_id)).size;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this deployment.");
    const provider = resolveProvider({ apiKey });

    const result = await provider.generate({
      systemPrompt:
        "You write brief administrative activity summaries for a manager. Use only the supplied counts. Never mention client names or case-note content. Two or three sentences maximum.",
      userPrompt: JSON.stringify({
        date: day,
        activeStaff: staff,
        caseNotes: (notes ?? []).length,
        openDrafts: (drafts ?? []).length,
        departments: deptCounts,
      }),
    });

    await audit(context.supabase, ctx, "report.daily_summary_generated", "organization", ctx.organizationId, {
      date: day,
    });
    return { summary: result.text };
  });
