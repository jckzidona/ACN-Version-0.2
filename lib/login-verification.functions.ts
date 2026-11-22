import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Sends a 6-digit sign-in verification code by text message to the
 * worker's registered phone. Email codes go through the built-in
 * email sign-in code on the client instead.
 */
export const sendLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ channel: z.enum(["sms"]) }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.phone) {
      throw new Error(
        "No phone number is registered on your profile. Add one on the My profile page, or choose the email code instead.",
      );
    }

    const twilioKey = process.env["TWILIO_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (!twilioKey || !lovableKey) {
      throw new Error(
        "Text message codes are not set up yet. Please choose the email code instead.",
      );
    }

    const code = generateCode();

    // Invalidate any older unused codes for this user.
    await supabaseAdmin
      .from("login_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("consumed_at", null);

    const { error: insertError } = await supabaseAdmin
      .from("login_verification_codes")
      .insert({
        user_id: context.userId,
        code,
        channel: "sms",
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      });
    if (insertError) throw new Error("Could not create the code. Please try again.");

    const response = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: profile.phone,
        From: process.env["TWILIO_FROM_NUMBER"] ?? "",
        Body: `Your ACN sign-in code is ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Twilio send failed [${response.status}]: ${body}`);
      throw new Error("Could not send the text message. Please choose the email code instead.");
    }

    return { ok: true, phone: profile.phone.replace(/.(?=.{2})/g, "•") };
  });

/**
 * Verifies a text-message sign-in code. Email codes are verified
 * client-side through the built-in email code flow.
 */
export const verifyLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().length(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("login_verification_codes")
      .select("id, code, expires_at, attempts")
      .eq("user_id", context.userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("No active code. Please request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("That code has expired. Please request a new one.");
    }
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      throw new Error("Too many wrong tries. Please request a new code.");
    }

    if (row.code !== data.code) {
      await supabaseAdmin
        .from("login_verification_codes")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id);
      throw new Error("That code is not correct. Please try again.");
    }

    await supabaseAdmin
      .from("login_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true };
  });
