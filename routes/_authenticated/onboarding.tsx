import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import {
  createOrganization,
  joinOrganization,
  lookupOrganization,
} from "@/lib/session.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your organization — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Create a new organization or join an existing one with a code.",
      },
      { property: "og:title", content: "Set up your organization" },
      {
        property: "og:description",
        content: "Create or join an organization to start documenting interactions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type Lookup = { id: string; name: string; departments: { id: string; name: string }[] } | null;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useSession();
  const create = useServerFn(createOrganization);
  const join = useServerFn(joinOrganization);
  const lookup = useServerFn(lookupOrganization);

  const [mode, setMode] = useState<"join" | "create">("join");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [orgName, setOrgName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [found, setFound] = useState<Lookup>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState<"worker" | "manager">("worker");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.fullName && !fullName) setFullName(session.fullName);
    if (session?.onboarded) {
      const manager = session.roles.includes("manager") || session.roles.includes("org_admin");
      navigate({ to: manager ? "/reports" : "/dashboard", replace: true });
    }
  }, [session, fullName, navigate]);

  async function handleLookup() {
    setBusy(true);
    try {
      const org = await lookup({ data: { joinCode } });
      if (!org) {
        setFound(null);
        toast.error("That organization code was not recognised.");
        return;
      }
      setFound(org);
      setDepartmentId(org.departments[0]?.id ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      if (mode === "create") {
        const result = await create({
          data: { name: orgName, fullName, jobTitle: jobTitle || undefined },
        });
        toast.success(`Organization created. Join code: ${result.joinCode}`);
      } else {
        if (!found || !departmentId) {
          toast.error("Look up your organization code and choose a department first.");
          return;
        }
        await join({
          data: { joinCode, departmentId, fullName, jobTitle: jobTitle || undefined, role },
        });
        toast.success("You've joined the organization.");
      }
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({
        to: mode === "create" || role === "manager" ? "/reports" : "/dashboard",
        replace: true,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Set up your workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join your organization with a code, or create a new one if you're the first person here.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-md bg-secondary p-1 sm:mt-6">
          {(["join", "create"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-3 py-3 text-sm transition-colors sm:py-2 ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "join" ? "Join with code" : "Create organization"}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4 sm:mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Your full name</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Job title (optional)</Label>
            <Input
              id="title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="min-h-[44px]"
            />
          </div>

          {mode === "create" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="org">Organization name</Label>
                <Input
                  id="org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Your role</Label>
                <Input
                  id="create-role"
                  value="Admin — full control of this organization"
                  readOnly
                  disabled
                  className="min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">
                  Creating an organization makes you its Admin. Admins set up the organization,
                  change its name, logo, colours and welcome page, manage staff and roles, and
                  approve new accounts. Managers are a separate account type that oversees staff
                  activity but cannot change these settings.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Organization code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCD1234"
                    className="min-h-[44px] flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={handleLookup}
                    disabled={busy}
                  >
                    Find
                  </Button>
                </div>
              </div>
              {found && (
                <div className="space-y-2">
                  <Label htmlFor="role">Your role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as "worker" | "manager")}>
                    <SelectTrigger id="role" className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">Worker — write and manage case notes</SelectItem>
                      <SelectItem value="manager" disabled>Manager — your admin assigns this after you join</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {found && (
                <div className="space-y-2">
                  <Label htmlFor="dept">Department at {found.name}</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger id="dept" className="min-h-[44px]">
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {found.departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <Button
            className="min-h-[48px] w-full"
            onClick={finish}
            disabled={busy || fullName.trim().length < 2}
          >
            {busy ? "Please wait…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
