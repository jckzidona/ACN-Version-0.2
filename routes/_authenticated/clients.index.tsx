import { useAutoDraft } from "@/hooks/useAutoDraft";
import { Fragment, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient, listClientFamilies } from "@/lib/clients.functions";
import { CornerDownRight, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Search your organization's client records and add new intakes.",
      },
      { property: "og:title", content: "Clients" },
      {
        property: "og:description",
        content: "Search client records and register new client intakes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const queryClient = useQueryClient();
  const search = useServerFn(listClientFamilies);
  const create = useServerFn(createClient);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientIdentifier: "",
    firstName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: "",
    phone: "",
    email: "",
  });

  const clientDraft = useAutoDraft("new-client", open ? form : null, (d) => { if (d) { setForm(d); setOpen(true); } });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", "families", term],
    queryFn: () => search({ data: { query: term } }),
  });

  async function submit() {
    setBusy(true);
    try {
      const result = await create({
        data: {
          clientIdentifier: form.clientIdentifier,
          firstName: form.firstName,
          lastName: form.lastName,
          preferredName: form.preferredName || undefined,
          dateOfBirth: form.dateOfBirth || null,
          contact: { phone: form.phone, email: form.email },
        },
      });
      if (result.duplicate) { setOpen(false); setDuplicateId(result.id); return; }
      clientDraft.clear();
      toast.success("Client record created.");
      setOpen(false);
      setForm({
        clientIdentifier: "",
        firstName: "",
        lastName: "",
        preferredName: "",
        dateOfBirth: "",
        phone: "",
        email: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the client.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Clients"
      description="Shared client files and families in your organization"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New client intake</DialogTitle>
              <DialogDescription>
                Record only the identifying details your organization requires.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              A file number is assigned automatically when the client is created.
            </p>
            <div className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Identity</legend>
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(v) => setForm({ ...form, firstName: v })}
                />
                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(v) => setForm({ ...form, lastName: v })}
                />
                <Field
                  label="Preferred name"
                  value={form.preferredName}
                  onChange={(v) => setForm({ ...form, preferredName: v })}
                />
                <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Contact details</legend>
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                />
                <Field
                  label="Email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
              </fieldset>
            </div>
            <DialogFooter>
              <Button
                onClick={submit}
                disabled={
                  busy || !form.firstName || !form.lastName
                }
              >
                {busy ? "Saving…" : "Create client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Dialog open={Boolean(duplicateId)} onOpenChange={(v) => { if (!v) setDuplicateId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Client already exists</DialogTitle><DialogDescription>A matching client is already registered in your organization. Open the existing file instead of creating a duplicate.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDuplicateId(null)}>Back</Button>{duplicateId && <Button asChild><Link to="/clients/$clientId" params={{ clientId: duplicateId }}>Open existing client</Link></Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search by name or client ID"
        className="max-w-md"
      />

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Client ID</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (clients?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-muted-foreground">
                  No clients found.
                </td>
              </tr>
            )}
            {clients?.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td className="px-4 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                        Edit
                      </Link>
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-medium text-foreground">
                      {c.first_name} {c.last_name}
                      {c.preferred_name ? ` (${c.preferred_name})` : ""}
                    </span>
                    {c.children.length > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Users className="h-3 w-3" /> Head of family · {c.children.length}{" "}
                        {c.children.length === 1 ? "child" : "children"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.client_identifier}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.status}</td>
                </tr>
                {c.children.map((k) => (
                  <tr key={k.id} className="bg-secondary/25">
                    <td className="px-4 py-2" />
                    <td className="py-2 pl-10 pr-4 text-foreground">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Link to="/clients/$clientId" params={{ clientId: k.id }} className="text-primary underline underline-offset-4 hover:text-primary/80">
                          {k.first_name} {k.last_name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          ({k.family_relationship || "Child"}{ageText(k.date_of_birth)})
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{k.client_identifier}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{k.status}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-5 space-y-3 lg:hidden">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (clients?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No clients found.</p>
        )}
        {clients?.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-start gap-3 p-4">
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to="/clients/$clientId" params={{ clientId: c.id }}>
                  Edit
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {c.first_name} {c.last_name}
                  {c.preferred_name ? ` (${c.preferred_name})` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.client_identifier}
                  {c.children.length > 0 ? ` · Head of family` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {c.status}
              </span>
            </div>
            {c.children.length > 0 && (
              <div className="border-t border-border px-4 py-2">
                {c.children.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-2 py-1.5 text-sm text-foreground"
                  >
                    <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Link to="/clients/$clientId" params={{ clientId: k.id }} className="text-primary underline underline-offset-4 hover:text-primary/80">
                      {k.first_name} {k.last_name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      ({k.family_relationship || "Child"}{ageText(k.date_of_birth)})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ageText(dob: string | null) {
  if (!dob) return "";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  return Number.isFinite(years) && years >= 0 ? ` · ${years} yrs old` : "";
}
