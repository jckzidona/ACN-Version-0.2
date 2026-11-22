import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireApprovalAfterReset } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Choose a new password for your ACN — Assistance Case Note account.",
      },
      { property: "og:title", content: "Set a new password — ACN" },
      { property: "og:description", content: "Choose a new password for your ACN account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const result = await requireApprovalAfterReset().catch(() => null);
      await supabase.auth.signOut();
      toast.success(
        result?.pending === false
          ? "Password changed. You can sign in with your new password."
          : "Password changed. An admin or manager must approve your account before you can sign in.",
      );
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the password.");
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
          Set a new password
        </h1>
        {!ready ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This link has expired or was already used.{" "}
            <Link to="/forgot-password" className="underline underline-offset-4">
              Request a new code
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 sm:mt-6">
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
              {busy ? "Please wait…" : "Save new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
