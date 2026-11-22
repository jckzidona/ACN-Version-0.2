import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/useSession";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { exportCaseNotes, getActivityTimeline, getManagerOverview } from "@/lib/reports.functions";
import {
  addMember,
  setMemberStatus,
  listOrgMembers,
  setMemberRole,
  updateMember,
  updateOrganization,
} from "@/lib/admin.functions";
import { listDepartments } from "@/lib/session.functions";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type BackgroundChoice =
  | { type: "default" }
  | { type: "color"; color: string }
  | { type: "url"; url: string }
  | { type: "upload"; path: string };

function readBackground(value: unknown): BackgroundChoice {
  if (!value || typeof value !== "object") return { type: "default" };
  const item = value as Record<string, unknown>;
  if (item["type"] === "color" && typeof item["color"] === "string") return { type: "color", color: item["color"] };
  if (item["type"] === "url" && typeof item["url"] === "string") return { type: "url", url: item["url"] };
  if (item["type"] === "upload" && typeof item["path"] === "string") return { type: "upload", path: item["path"] };
  return { type: "default" };
}


export const Route = createFileRoute("/_authenticated/manager")({
  head: () => ({
    meta: [
      { title: "Manager console — ACN — Assistance Case Note" },
      {
        name: "description",
        content:
          "Track worker activity, department workload, staff roles and audit history across your organization.",
      },
      { property: "og:title", content: "Manager console" },
      {
        property: "og:description",
        content: "Organization-wide case note activity, staff roles and audit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagerConsole,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ManagerConsole() {
  const { data: session, isPending: sessionPending } = useSession();
  const isManager =
    session?.roles.includes("manager") || session?.roles.includes("org_admin") || false;

  if (sessionPending) {
    return (
      <AppShell title="Manager console" description="Checking your access">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!isManager) {
    return (
      <AppShell title="Restricted area" description="Manager access required">
        <div className="max-w-lg rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">You do not have access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The manager console is limited to managers and organization admins. Ask an
            organization admin to update your role if you need access.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <ManagerConsoleContent />;
}

function ManagerConsoleContent() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isOrgAdmin = session?.roles.includes("org_admin") ?? false;
  const fetchOverview = useServerFn(getManagerOverview);
  const fetchTimeline = useServerFn(getActivityTimeline);
  const fetchMembers = useServerFn(listOrgMembers);
  const exportCsv = useServerFn(exportCaseNotes);
  const changeRole = useServerFn(setMemberRole);
  const changeStatus = useServerFn(setMemberStatus);
  const [addingMember, setAddingMember] = useState(false);

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [editingId, setEditingId] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["manager-overview", from, to],
    queryFn: () => fetchOverview({ data: { from, to } }),
  });
  const timeline = useQuery({
    queryKey: ["activity-timeline", to],
    queryFn: () => fetchTimeline({ data: { date: to } }),
  });
  const members = useQuery({
    queryKey: ["org-members"],
    queryFn: () => fetchMembers(),
    enabled: isOrgAdmin,
  });

  async function handleExport() {
    try {
      const result = await exportCsv({ data: { from, to } });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `case-notes-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.rows} case notes.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function handleRoleChange(userId: string, role: "worker" | "manager" | "org_admin") {
    try {
      await changeRole({ data: { userId, role } });
      await queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Role updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the role.");
    }
  }

  async function handleStatus(
    userId: string,
    name: string,
    status: "pending" | "active" | "inactive" | "archived",
  ) {
    const prompts = {
      pending: `Put ${name}'s account back on hold?`,
      active: `Approve access for ${name}?`,
      inactive: `Deactivate ${name}'s account? They will keep their records but lose access.`,
      archived: `Archive ${name}'s account? Use this when someone has left the organization.`,
    } as const;
    if (!window.confirm(prompts[status])) return;
    try {
      await changeStatus({ data: { userId, status } });
      await queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success(
        status === "active"
          ? "Account approved."
          : status === "inactive"
            ? "Account deactivated."
            : status === "pending"
              ? "Account put on hold."
              : "Account archived.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the account.");
    }
  }

  const totals = overview.data?.totals;

  return (
    <AppShell
      title="Manager console"
      description="Worker activity, workload and audit history across the organization"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/organization-settings">Organization settings</Link></Button>
          <Button size="sm" variant="outline" onClick={() => void handleExport()}>Export CSV</Button>
        </div>
      }
    >
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </section>

      {overview.isError && (
        <p className="mt-6 text-sm text-destructive">
          {overview.error instanceof Error
            ? overview.error.message
            : "You do not have permission to view this information."}
        </p>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-6 lg:grid-cols-4 lg:gap-4">
        {[
          { label: "Notes in range", value: totals?.notes ?? 0 },
          { label: "Completed", value: totals?.completed ?? 0 },
          { label: "Open drafts", value: totals?.drafts ?? 0 },
          { label: "Active staff", value: totals?.activeStaff ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-2 lg:gap-6">
        <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
          <h2 className="text-sm font-semibold text-foreground">Activity by worker</h2>
          <div className="mt-3 divide-y divide-border">
            {(overview.data?.byWorker ?? []).map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {w.jobTitle ?? "Staff"} · {w.department}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {w.notes} notes · {w.completed} final · {w.drafts} drafts
                </p>
              </div>
            ))}
            {(overview.data?.byWorker.length ?? 0) === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No staff activity yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
          <h2 className="text-sm font-semibold text-foreground">Activity by department</h2>
          <div className="mt-3 divide-y divide-border">
            {(overview.data?.byDepartment ?? []).map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <p className="truncate text-sm text-foreground">{d.name}</p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {d.notes} notes · {d.drafts} drafts · {d.staff} staff
                </p>
              </div>
            ))}
            {(overview.data?.byDepartment.length ?? 0) === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No departments yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4 lg:mt-6 lg:p-5">
        <h2 className="text-sm font-semibold text-foreground">Access requests</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          New accounts and anyone who reset their password stay locked out until you approve them.
        </p>
        <div className="mt-3 divide-y divide-border">
          {(members.data?.members ?? [])
            .filter((m) => m.status === "pending")
            .map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{m.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email ?? "—"} · {m.department} · {(m.roles.length ? m.roles : ["worker"]).join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-[40px]"
                    onClick={() => void handleStatus(m.id, m.fullName, "active")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[40px]"
                    onClick={() => void handleStatus(m.id, m.fullName, "archived")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          {(members.data?.members ?? []).filter((m) => m.status === "pending").length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">No one is waiting for approval.</p>
          )}
        </div>
      </section>

      {isOrgAdmin && (
      <section className="mt-4 rounded-lg border border-border bg-card p-4 lg:mt-6 lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Staff and roles</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add, edit, deactivate or remove staff accounts. Only organization admins can manage staff.
            </p>
          </div>
          {members.data?.canManageRoles && (
            <Button size="sm" onClick={() => setAddingMember((v) => !v)}>
              {addingMember ? "Close" : "Add worker"}
            </Button>
          )}
        </div>
        {addingMember && members.data?.canManageRoles && (
          <AddMemberForm
            isOrgAdmin={isOrgAdmin}
            onDone={() => {
              setAddingMember(false);
              void queryClient.invalidateQueries({ queryKey: ["org-members"] });
            }}
          />
        )}
        <div className="mt-3 divide-y divide-border">
          {(members.data?.members ?? []).map((m) => (
            <div key={m.id} className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {m.fullName}
                    {m.status !== "active" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.status === "archived"
                          ? "Archived"
                          : m.status === "pending"
                            ? "Awaiting approval"
                            : "Deactivated"}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email ?? "—"} · {m.department}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {members.data?.canManageRoles && m.id !== members.data.selfId ? (
                    <Select
                      value={m.roles[0] ?? "worker"}
                      onValueChange={(v) =>
                        void handleRoleChange(m.id, v as "worker" | "manager" | "org_admin")
                      }
                    >
                      <SelectTrigger className="min-h-[40px] w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worker">Worker</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        {isOrgAdmin && <SelectItem value="org_admin">Organization admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {(m.roles.length ? m.roles : ["worker"]).join(", ")}
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline" className="min-h-[40px]">
                    <Link to="/print" search={{ ids: undefined, worker: m.id }}>
                      Print notes (PDF)
                    </Link>
                  </Button>
                  {members.data?.canManageRoles && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[40px]"
                        onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                      >
                        {editingId === m.id ? "Close" : "Edit"}
                      </Button>
                      {m.id !== members.data.selfId && (
                        <>
                          {m.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-[40px]"
                              onClick={() => void handleStatus(m.id, m.fullName, "inactive")}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-[40px]"
                              onClick={() => void handleStatus(m.id, m.fullName, "active")}
                            >
                              {m.status === "pending" ? "Approve" : "Reactivate"}
                            </Button>
                          )}
                          {m.status !== "archived" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="min-h-[40px]"
                              onClick={() => void handleStatus(m.id, m.fullName, "archived")}
                            >
                              Archive
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {editingId === m.id && members.data?.canManageRoles && (
                <MemberEditor
                  member={m}
                  onDone={() => {
                    setEditingId(null);
                    void queryClient.invalidateQueries({ queryKey: ["org-members"] });
                  }}
                />
              )}
            </div>
          ))}
          {(members.data?.members.length ?? 0) === 0 && (
            <p className="py-2 text-sm text-muted-foreground">No staff records yet.</p>
          )}
        </div>
      </section>
      )}

      <section className="mt-4 rounded-lg border border-border bg-card p-4 lg:mt-6 lg:p-5">
        <h2 className="text-sm font-semibold text-foreground">Audit activity for {to}</h2>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {(timeline.data ?? []).map((row) => (
            <li key={row.id} className="py-1 sm:py-0">
              {new Date(row.created_at).toLocaleTimeString()} · {row.actor} · {row.action}
            </li>
          ))}
          {(timeline.data?.length ?? 0) === 0 && <li>No recorded activity for this date.</li>}
        </ul>
      </section>
    </AppShell>
  );
}

function OrganizationSettings() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const save = useServerFn(updateOrganization);
  const org = session?.organization;
  const settings = (org?.settings ?? {}) as Record<string, unknown>;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColors, setAccentColors] = useState<string[]>(["#1f4d5c", "#2a9d8f", "#e9c46a"]);
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [publicBackground, setPublicBackground] = useState<BackgroundChoice>({ type: "default" });
  const [workspaceBackground, setWorkspaceBackground] = useState<BackgroundChoice>({ type: "default" });
  const [uploading, setUploading] = useState<"public" | "workspace" | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (org && !loaded) {
    setLoaded(true);
    setName(org.name);
    setLogoUrl(org.logo_url ?? "");
    const saved = settings["accentColors"];
    const fallback: [string, string, string] = [
      org.primary_color ?? "#1f4d5c",
      (org as { secondary_color?: string | null }).secondary_color ?? "#2a9d8f",
      "#e9c46a",
    ];
    const colors = Array.isArray(saved) ? saved.filter((c): c is string => typeof c === "string") : [];
    setAccentColors([colors[0] ?? fallback[0], colors[1] ?? fallback[1], colors[2] ?? fallback[2]]);
    setHeadline(typeof settings["welcomeHeadline"] === "string" ? (settings["welcomeHeadline"] as string) : "");
    setMessage(typeof settings["welcomeMessage"] === "string" ? (settings["welcomeMessage"] as string) : "");
    setPublicBackground(readBackground(settings["publicBackground"]));
    setWorkspaceBackground(readBackground(settings["workspaceBackground"]));
  }

  const canCustomize = session?.roles.some((role) => role === "manager" || role === "org_admin") ?? false;
  if (!canCustomize) return null;

  async function uploadBackground(area: "public" | "workspace", file: File) {
    if (!org) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("The picture must be 8 MB or smaller.");
      return;
    }
    setUploading(area);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${org.id}/${area}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("organization-branding").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const choice: BackgroundChoice = { type: "upload", path };
      if (area === "public") setPublicBackground(choice);
      else setWorkspaceBackground(choice);
      toast.success("Picture uploaded. Save the organization to apply it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the picture.");
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          name: name.trim(),
          legalName: legalName.trim() || null,
          logoUrl: logoUrl.trim() || null,
          accentColors,
          welcomeHeadline: headline.trim() || null,
          welcomeMessage: message.trim() || null,
          publicBackground,
          workspaceBackground,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Organization details updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the organization.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-card p-4 lg:mt-6 lg:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Organization settings</h2>
          <p className="text-xs text-muted-foreground">
            Set the organization identity, welcome page and signed-in workspace appearance.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Edit"}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name (optional)</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.org/logo.png"
            />
          </div>
          <div className="space-y-2">
            <Label>Accent colours (choose 3)</Label>
            <div className="flex flex-wrap gap-3">
              {accentColors.map((color, index) => (
                <label key={index} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  <Input
                    type="color"
                    aria-label={`Accent colour ${index + 1}`}
                    value={color}
                    onChange={(e) =>
                      setAccentColors((prev) => prev.map((c, i) => (i === index ? e.target.value : c)))
                    }
                    className="h-11 w-20 p-1"
                  />
                  Colour {index + 1}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Colour 1 is the main accent; colours 2 and 3 support highlights and the sidebar.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="headline">Welcome headline (optional)</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="welcome">Welcome message (optional)</Label>
            <Textarea id="welcome" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <BackgroundEditor
            title="Public welcome page background"
            value={publicBackground}
            onChange={setPublicBackground}
            onUpload={(file) => void uploadBackground("public", file)}
            uploading={uploading === "public"}
          />
          <BackgroundEditor
            title="Signed-in workspace background"
            value={workspaceBackground}
            onChange={setWorkspaceBackground}
            onUpload={(file) => void uploadBackground("workspace", file)}
            uploading={uploading === "workspace"}
          />
          {org?.join_code && (
            <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground lg:col-span-2">
              Organization welcome link: <span className="break-all text-foreground">{`${window.location.origin}/welcome/${org.join_code}`}</span>
            </div>
          )}
          <div className="lg:col-span-2">
            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? "Saving…" : "Save organization"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function BackgroundEditor({
  title,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  title: string;
  value: BackgroundChoice;
  onChange: (value: BackgroundChoice) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <fieldset className="space-y-3 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">{title}</legend>
      <div className="space-y-2">
        <Label>Background choice</Label>
        <Select
          value={value.type}
          onValueChange={(type) => {
            if (type === "color") onChange({ type, color: "#eef6f5" });
            else if (type === "url") onChange({ type, url: "" });
            else if (type === "upload") onChange(value.type === "upload" ? value : { type, path: "" });
            else onChange({ type: "default" });
          }}
        >
          <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="color">Colour</SelectItem>
            <SelectItem value="upload">Upload a picture</SelectItem>
            <SelectItem value="url">Use an image link</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.type === "color" && (
        <div className="space-y-2">
          <Label>Background colour</Label>
          <Input type="color" value={value.color} onChange={(event) => onChange({ type: "color", color: event.target.value })} className="h-11 w-24 p-1" />
        </div>
      )}
      {value.type === "url" && (
        <div className="space-y-2">
          <Label>HTTPS image link</Label>
          <Input type="url" value={value.url} onChange={(event) => onChange({ type: "url", url: event.target.value })} placeholder="https://example.org/background.jpg" required />
        </div>
      )}
      {value.type === "upload" && (
        <div className="space-y-2">
          <Label>Picture file</Label>
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={uploading} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }} />
          <p className="text-xs text-muted-foreground">{uploading ? "Uploading…" : value.path ? "Picture ready to save." : "PNG, JPG, WebP or AVIF, up to 8 MB."}</p>
        </div>
      )}
    </fieldset>
  );
}

interface EditableMember {
  id: string;
  fullName: string;
  jobTitle: string | null;
  departmentId: string | null;
  status: string;
}

function MemberEditor({ member, onDone }: { member: EditableMember; onDone: () => void }) {
  const save = useServerFn(updateMember);
  const fetchDepartments = useServerFn(listDepartments);
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchDepartments(),
    staleTime: 60_000,
  });

  const [fullName, setFullName] = useState(member.fullName);
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [departmentId, setDepartmentId] = useState(member.departmentId ?? "none");
  const [status, setStatus] = useState(
    member.status === "active" || member.status === "archived" || member.status === "pending"
      ? member.status
      : "inactive",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          userId: member.id,
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim() || null,
          departmentId: departmentId === "none" ? null : departmentId,
          status: status as "pending" | "active" | "inactive" | "archived",
        },
      });
      toast.success("Staff details updated.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`name-${member.id}`}>Full name</Label>
        <Input
          id={`name-${member.id}`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`job-${member.id}`}>Job title</Label>
        <Input
          id={`job-${member.id}`}
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="No department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No department</SelectItem>
            {departments.map((d: { id: string; name: string }) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Account status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Awaiting approval</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
            <SelectItem value="archived">Archived (left the organization)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
        <Button
          type="submit"
          size="sm"
          className="min-h-[44px]"
          disabled={busy || fullName.trim().length === 0}
        >
          {busy ? "Saving\u2026" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddMemberForm({ isOrgAdmin, onDone }: { isOrgAdmin: boolean; onDone: () => void }) {
  const add = useServerFn(addMember);
  const fetchDepartments = useServerFn(listDepartments);
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchDepartments(),
    staleTime: 60_000,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("none");
  const [role, setRole] = useState<"worker" | "manager" | "org_admin">("worker");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await add({
        data: {
          email: email.trim(),
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim() || null,
          departmentId: departmentId === "none" ? null : departmentId,
          role: role === "org_admin" ? "manager" : role,
        },
      });
      toast.success("Worker added. They will receive an email invitation to set their password.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add this worker.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-2"
    >
      <div className="space-y-2">
        <Label htmlFor="add-name">Full name</Label>
        <Input
          id="add-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-email">Work email</Label>
        <Input
          id="add-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="worker@example.org"
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-job">Job title</Label>
        <Input
          id="add-job"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Settlement Worker"
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="No department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No department</SelectItem>
            {departments.map((d: { id: string; name: string }) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as "worker" | "manager")}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="worker">Worker</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            {isOrgAdmin && <SelectItem value="org_admin">Organization admin</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Button
          type="submit"
          size="sm"
          className="min-h-[44px]"
          disabled={busy || fullName.trim().length < 2 || !email.includes("@")}
        >
          {busy ? "Adding…" : "Add and send invitation"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
