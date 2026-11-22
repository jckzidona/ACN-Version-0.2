import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/session.functions";
import { sendLoginCode, verifyLoginCode } from "@/lib/login-verification.functions";
import { isAdmin, isManager } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signin" | "signup" } => {
    const mode = search["mode"];
    return mode === "signup" || mode === "signin" ? { mode } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Sign in or create a worker account for the ACN — Assistance Case Note.",
      },
      { property: "og:title", content: "Sign in — ACN — Assistance Case Note" },
      {
        property: "og:description",
        content: "Access your organization's case notes, drafts and client records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// Sign-in verification (email/SMS 6-digit code) is disabled while the app is in
// the testing phase: workers sign in with just email + password.
// Set to true to require the code step after the password again.
const REQUIRE_SIGNIN_VERIFICATION = false;

type Step = "credentials" | "verify";

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestSmsCode = useServerFn(sendLoginCode);
  const checkSmsCode = useServerFn(verifyLoginCode);

  const { mode: selectedMode } = Route.useSearch();
  const mode = selectedMode ?? "signin";
  function setMode(nextMode: "signin" | "signup") {
    void navigate({ to: "/auth", search: { mode: nextMode } });
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<Step>("credentials");
  const [channel, setChannel] = useState<"email" | "sms" | null>(null);
  const [code, setCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);

  async function finishSignIn() {
    const session = await getSession().catch(() => null);
    if (session) queryClient.setQueryData(["session"], session);
    if (!session || !session.onboarded) {
      navigate({ to: "/onboarding" });
    } else if (isManager(session.roles) || isAdmin(session.roles)) {
      navigate({ to: "/reports" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          toast.success("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
        await finishSignIn();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // Password is correct — go straight in, or ask for a verification code
      // when REQUIRE_SIGNIN_VERIFICATION is enabled (currently off for testing).
      if (REQUIRE_SIGNIN_VERIFICATION) {
        setStep("verify");
      } else {
        await finishSignIn();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseChannel(choice: "email" | "sms") {
    setBusy(true);
    setChannel(choice);
    setCode("");
    try {
      if (choice === "email") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        toast.success(`A 6-digit code was sent to ${email}.`);
      } else {
        const result = await requestSmsCode({ data: { channel: "sms" } });
        setMaskedPhone(result.phone);
        toast.success("A 6-digit code was sent to your phone.");
      }
    } catch (err) {
      setChannel(null);
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (channel === "email") {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: "email",
        });
        if (error) throw new Error("That code is not correct or has expired. Please try again.");
      } else {
        await checkSmsCode({ data: { code: code.trim() } });
      }
      await finishSignIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setChannel(null);
    setCode("");
    void supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground sm:text-xs">
          ← Back
        </Link>

        {step === "credentials" ? (
          <>
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:mt-4 sm:text-xl">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Access your organization's case notes and drafts."
                : "You'll create or join an organization on the next step."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4 sm:mt-6">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    className="min-h-[44px]"
                  />
                </div>
              )}
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="min-h-[44px]"
                />
              </div>
              <Button type="submit" className="min-h-[48px] w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <Link
                to="/forgot-password"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:mt-6"
            >
              {mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:mt-4 sm:text-xl">
              Verify it's you
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your password is correct. Choose where to receive your 6-digit sign-in code.
            </p>

            <div className="mt-5 grid gap-3 sm:mt-6">
              <Button
                type="button"
                variant={channel === "email" ? "default" : "outline"}
                className="min-h-[48px] justify-start gap-3"
                disabled={busy}
                onClick={() => void chooseChannel("email")}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email a code to {email}
              </Button>
              <Button
                type="button"
                variant={channel === "sms" ? "default" : "outline"}
                className="min-h-[48px] justify-start gap-3"
                disabled={busy}
                onClick={() => void chooseChannel("sms")}
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Text a code to my phone{maskedPhone ? ` (${maskedPhone})` : ""}
              </Button>
            </div>

            {channel && (
              <form onSubmit={handleVerify} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="min-h-[44px] text-center text-lg tracking-[0.5em]"
                  />
                </div>
                <Button
                  type="submit"
                  className="min-h-[48px] w-full"
                  disabled={busy || code.trim().length !== 6}
                >
                  {busy ? "Checking…" : "Verify and sign in"}
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={backToCredentials}
              className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:mt-6"
            >
              ← Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
