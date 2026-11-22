import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireApprovalAfterReset } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recover your account — ACN — Assistance Case Note" },
      {
        name: "description",
        content:
          "Reset your ACN password with a confirmation code sent to your work email, then wait for admin approval.",
      },
      { property: "og:title", content: "Recover your account — ACN" },
      {
        property: "og:description",
        content: "Get a confirmation code by email and set a new password for ACN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(
        "Email sent. It can take a few minutes — check your spam or junk folder too.",
      );
      setStep("code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "recovery",
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const result = await requireApprovalAfterReset().catch(() => null);
      await supabase.auth.signOut();

      toast.success(
        result?.pending === false
          ? "Password changed. You can sign in with your new password."
          : "Password changed. An admin or manager must approve your account before you can sign in.",
      );
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground sm:text-xs">
          ← Back to sign in
        </Link>
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:mt-4 sm:text-xl">
          Recover your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "email"
            ? "Enter your work email and we'll send you a confirmation code. Your work email is also your username."
            : "Enter the code from your email and choose a new password."}
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-5 space-y-4 sm:mt-6">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="min-h-[44px]"
              />
            </div>
            <Button type="submit" className="min-h-[48px] w-full" disabled={busy}>
              {busy ? "Sending…" : "Send confirmation code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-5 space-y-4 sm:mt-6">
            <div className="space-y-2">
              <Label htmlFor="code">Confirmation code</Label>
              <Input
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="6-digit code"
                className="min-h-[44px] tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="min-h-[44px]"
              />
            </div>
            <Button type="submit" className="min-h-[48px] w-full" disabled={busy}>
              {busy ? "Please wait…" : "Set new password"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Send the code again
            </button>
          </form>
        )}

        <p className="mt-5 text-xs text-muted-foreground">
          After you change your password, an admin or manager has to approve your account again
          before you can get back into the app.
        </p>
      </div>
    </div>
  );
}
