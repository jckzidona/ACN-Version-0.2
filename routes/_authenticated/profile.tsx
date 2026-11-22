import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import { listDepartments, updateProfile } from "@/lib/session.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Update your name, job title and department for case note attribution.",
      },
      { property: "og:title", content: "My profile — ACN — Assistance Case Note" },
      {
        property: "og:description",
        content: "Keep your worker details accurate across every case note you author.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useSession();
  const save = useServerFn(updateProfile);
  const fetchDepartments = useServerFn(listDepartments);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchDepartments(),
    staleTime: 60_000,
  });

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("details");
  const toggleSection = (key: string) => setOpenSection((cur) => (cur === key ? null : key));
  const isAdminUser = session?.roles.includes("org_admin") ?? false;

  useEffect(() => {
    if (!session) return;
    setFullName(session.fullName ?? "");
    setJobTitle(session.jobTitle ?? "");
    setPhone(session.phone ?? "");
    setDepartmentId(session.department?.id ?? "");
  }, [session]);

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim() ? jobTitle.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
          ...(isAdminUser && departmentId ? { departmentId } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="My profile" description="Your details appear on every case note you author.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid max-w-4xl gap-4 lg:grid-cols-[2fr_1fr] lg:gap-6">
          <section className="self-start rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-6">
            <button
              type="button"
              onClick={() => toggleSection("details")}
              aria-expanded={openSection === "details"}
              className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left"
            >
              <h2 className="text-sm font-semibold text-foreground">Profile details</h2>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform${openSection === "details" ? " rotate-180" : ""}`} />
            </button>
            {openSection === "details" && (
            <form
              onSubmit={handleSubmit}
              className="mt-3 space-y-5"
            >
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Settlement Worker"
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Mobile phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 204 555 0123"
                autoComplete="tel"
                className="min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                Used to text you a sign-in code. Include the country code, e.g. +1 for Canada.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {isAdminUser ? (
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="department" className="min-h-[44px]">
                    <SelectValue placeholder="Choose a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="department" value={session?.department?.name ?? "Not assigned"} readOnly disabled className="min-h-[44px]" />
              )}
              <p className="text-xs text-muted-foreground">
                {isAdminUser
                  ? "Your department controls which clients and templates you can see."
                  : "Your department is set by your organization admin and controls which clients you can see."}
              </p>
            </div>


            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                value={session?.email ?? ""}
                readOnly
                disabled
                className="min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                Email is tied to your sign-in and cannot be changed here.
              </p>
            </div>

            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={busy || fullName.trim().length < 2}
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
            </form>
            )}
          </section>

          <aside className="h-fit space-y-3 rounded-xl border border-border bg-card p-5 text-sm shadow-[var(--shadow-panel)] lg:p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Organization</p>
              <p className="text-foreground">{session?.organization?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Join code</p>
              <p className="font-mono text-foreground">{session?.organization?.join_code ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Roles</p>
              <p className="text-foreground">
                {session?.roles.length ? session.roles.join(", ") : "worker"}
              </p>
            </div>
          </aside>

          <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:col-span-2 lg:p-6">
            <button
              type="button"
              onClick={() => toggleSection("password")}
              aria-expanded={openSection === "password"}
              className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left"
            >
              <h2 className="text-sm font-semibold text-foreground">Change password</h2>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform${openSection === "password" ? " rotate-180" : ""}`}
              />
            </button>
            {openSection === "password" && (
              <form onSubmit={handlePasswordChange} className="mt-3 space-y-5">
                <p className="text-xs text-muted-foreground">
                  Enter your current password, then choose a new one (at least 8 characters).
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Repeat new password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={passwordBusy || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  {passwordBusy ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
