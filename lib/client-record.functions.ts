import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext } from "./authz";
import { sharedClientRows, clientRpc, ownsClientDetails } from "./shared-clients";

type Ctx = Awaited<ReturnType<typeof loadContext>>;
type Sb = Parameters<typeof loadContext>[0];

/** Enforces confidentiality: restricted clients are only visible in full to their department, creator, and managers. */
async function assertFullAccess(sb: Sb, ctx: Ctx, clientId: string) {
  const c = (await sharedClientRows(sb)).find((r) => r.id === clientId);
  if (!c || c.organization_id !== ctx.organizationId) throw new Error("Client not found.");
  return c;
}

const Id = z.object({ clientId: z.string().uuid() });

export const getClientRecordExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const all = await sharedClientRows(context.supabase);
    const client = all.find((r) => r.id === data.clientId) ?? null;
    if (!client) throw new Error("Client not found.");
    const restricted = false;
    const sharedOnly = !ownsClientDetails(ctx, client.department_id);
    const children = all.filter((r) => r.parent_client_id === data.clientId).map(({ id, first_name, last_name, client_identifier, family_relationship, date_of_birth }) => ({ id, first_name, last_name, client_identifier, family_relationship, date_of_birth }));
    const p = all.find((r) => r.id === client.parent_client_id);
    const parent = p ? { id: p.id, first_name: p.first_name, last_name: p.last_name, client_identifier: p.client_identifier } : null;
    const [{ data: referrals }, { data: documents }] = await Promise.all([
      context.supabase
        .from("client_referrals")
        .select("*")
        .eq("client_id", data.clientId)
        .order("referral_date", { ascending: false }),
      context.supabase
        .from("client_documents")
        .select("id, name, document_type, expiry_date, review_notes, created_at, mime_type")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false }),
    ]);
    return { restricted, sharedOnly, client, parent, children: children ?? [], referrals: referrals ?? [], documents: documents ?? [] };
  });

export const updateEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        enrollmentDate: z.string().max(20).nullable(),
        intakeDate: z.string().max(20).nullable(),
        enrolledProgram: z.string().max(120).nullable(),
        consentToShare: z.boolean(),
        confidentialityLevel: z.enum(["standard", "restricted", "highly_confidential"]),
        parentClientId: z.string().uuid().nullable(),
        familyRelationship: z.string().max(60).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const client = await assertFullAccess(context.supabase, ctx, data.clientId);
    if (data.parentClientId === data.clientId) throw new Error("A client cannot be their own parent.");
    if (!ownsClientDetails(ctx, client.department_id)) {
      await clientRpc(context.supabase, "shared_client_update", { _id: data.clientId, _patch: {
        enrollment_date: data.enrollmentDate || null, enrolled_program: data.enrolledProgram || null,
        parent_client_id: data.parentClientId, family_relationship: data.familyRelationship || null,
      } });
    } else {
    const { error } = await context.supabase
      .from("clients")
      .update({
        enrollment_date: data.enrollmentDate || null,
        intake_date: data.intakeDate || null,
        enrolled_program: data.enrolledProgram || null,
        consent_to_share: data.consentToShare,
        consent_accepted_at: data.consentToShare ? new Date().toISOString() : null,
        confidentiality_level: data.confidentialityLevel,
        parent_client_id: data.parentClientId,
        family_relationship: data.familyRelationship || null,
      })
      .eq("id", data.clientId)
      .eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    }
    await audit(context.supabase, ctx, "client.enrollment_updated", "client", data.clientId, {
      confidentiality: data.confidentialityLevel,
    });
    return { ok: true };
  });

export const saveReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        clientId: z.string().uuid(),
        referredTo: z.string().min(1).max(200),
        reason: z.string().min(1).max(1000),
        referralDate: z.string().min(8).max(20),
        status: z.enum(["sent", "accepted", "completed", "declined"]),
        followUpDate: z.string().max(20).nullable(),
        notes: z.string().max(2000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    await assertFullAccess(context.supabase, ctx, data.clientId);
    const row = {
      referred_to: data.referredTo,
      reason: data.reason,
      referral_date: data.referralDate,
      status: data.status,
      follow_up_date: data.followUpDate || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("client_referrals").update(row).eq("id", data.id).eq("client_id", data.clientId).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
      await audit(context.supabase, ctx, "referral.updated", "client_referral", data.id, { status: data.status });
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("client_referrals")
      .insert({ ...row, organization_id: ctx.organizationId, client_id: data.clientId, created_by: ctx.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "referral.created", "client_referral", ins.id);
    return { id: ins.id };
  });

export const registerClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        name: z.string().min(1).max(200),
        documentType: z.string().min(1).max(60),
        storagePath: z.string().min(1).max(400),
        mimeType: z.string().max(120).nullable(),
        expiryDate: z.string().max(20).nullable(),
        note: z.string().max(1000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    await assertFullAccess(context.supabase, ctx, data.clientId);
    if (!data.storagePath.startsWith(`${data.clientId}/`)) throw new Error("Invalid file location.");
    const { data: row, error } = await context.supabase
      .from("client_documents")
      .insert({
        organization_id: ctx.organizationId,
        client_id: data.clientId,
        name: data.name,
        document_type: data.documentType,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        expiry_date: data.expiryDate || null,
        review_notes: data.note || null,
        uploaded_by: ctx.userId,
        status: "submitted",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "client_document.uploaded", "client_document", row.id, {
      type: data.documentType,
    });
    return { id: row.id };
  });

export const openClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: doc, error } = await context.supabase
      .from("client_documents")
      .select("id, client_id, storage_path")
      .eq("id", data.id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (error || !doc) throw new Error("Document not found.");
    await assertFullAccess(context.supabase, ctx, doc.client_id);
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.storage_path, 120);
    if (sErr || !signed) throw new Error("Could not open the document.");
    await audit(context.supabase, ctx, "client_document.viewed", "client_document", doc.id);
    return { url: signed.signedUrl };
  });

export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: doc } = await context.supabase
      .from("client_documents")
      .select("id, client_id, storage_path")
      .eq("id", data.id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found.");
    await assertFullAccess(context.supabase, ctx, doc.client_id);
    const { error } = await context.supabase.from("client_documents").delete().eq("id", doc.id);
    if (error) throw new Error(error.message);
    await context.supabase.storage.from("client-documents").remove([doc.storage_path]);
    await audit(context.supabase, ctx, "client_document.deleted", "client_document", doc.id);
    return { ok: true };
  });
