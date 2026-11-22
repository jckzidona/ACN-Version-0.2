import { useAutoDraft } from "@/hooks/useAutoDraft";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listClientAppointments, saveAppointment } from "@/lib/appointments.functions";

const TYPES = ["Meeting", "Check-in", "Counselling session", "Phone call", "Home visit", "Video call"];
const STATUSES = ["scheduled", "attended", "missed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Draft = { id: string | null; type: string; start: string; minutes: string; location: string; status: Status; note: string };
const blank = (): Draft => ({ id: null, type: "Meeting", start: "", minutes: "60", location: "", status: "scheduled", note: "" });

function toOutlookDt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function outlookWebInviteUrl(a: { appointment_type: string; starts_at: string; ends_at: string; location: string | null; worker_note: string | null }) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: a.appointment_type,
    body: a.worker_note ?? "",
    startdt: new Date(a.starts_at).toISOString(),
    enddt: new Date(a.ends_at).toISOString(),
  });
  if (a.location) params.set("location", a.location);
  return `https://outlook.office.com/calendar/deeplink/compose?${params.toString()}`;
}

function downloadIcs(a: { appointment_type: string; starts_at: string; ends_at: string; location: string | null; worker_note: string | null }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACN//Appointment//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@acn`,
    `DTSTAMP:${toOutlookDt(new Date())}`,
    `DTSTART:${toOutlookDt(new Date(a.starts_at))}`,
    `DTEND:${toOutlookDt(new Date(a.ends_at))}`,
    `SUMMARY:${icsEscape(a.appointment_type)}`,
    `DESCRIPTION:${icsEscape(a.worker_note ?? "")}`,
    a.location ? `LOCATION:${icsEscape(a.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meeting-invite.ics";
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Invite downloaded. Open it to add it to your Outlook calendar and send it.");
}

export function AppointmentsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listClientAppointments);
  const save = useServerFn(saveAppointment);
  const { data } = useQuery({ queryKey: ["appointments", clientId], queryFn: () => list({ data: { clientId } }) });
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const apptDraft = useAutoDraft<Draft | null>(`appointment:${clientId}`, d, (v) => { if (v) setD(v); });

  async function submit() {
    if (!d?.start) { toast.error("Choose a date and time."); return; }
    const start = new Date(d.start);
    const end = new Date(start.getTime() + Math.max(5, Number(d.minutes) || 60) * 60000);
    setBusy(true);
    try {
      await save({
        data: {
          id: d.id,
          clientId,
          appointmentType: d.type,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          location: d.location || null,
          status: d.status,
          workerNote: d.note || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["appointments", clientId] });
      apptDraft.clear();
      toast.success("Appointment saved.");
      setD(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the appointment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-panel)] lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Appointments & check-ins</h3>
          <p className="text-xs text-muted-foreground">Track meetings and check-ins for this client.</p>
        </div>
        {!d && <Button size="sm" onClick={() => setD(blank())}>New appointment</Button>}
      </div>

      {d && (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={d.type} onValueChange={(v) => setD({ ...d, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={d.status} onValueChange={(v) => setD({ ...d, status: v as Status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date and time</Label>
            <Input type="datetime-local" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Length (minutes)</Label>
            <Input type="number" min={5} value={d.minutes} onChange={(e) => setD({ ...d, minutes: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Location or meeting link</Label>
            <Input value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Internal note</Label>
            <Textarea rows={2} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button variant="outline" onClick={() => setD(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {(data?.length ?? 0) === 0 && !d && <p className="text-muted-foreground">No appointments yet.</p>}
      <ul className="space-y-2">
        {data?.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground">{a.appointment_type} · {new Date(a.starts_at).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{a.location || "No location"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={a.status === "missed" || a.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setD({
                    id: a.id,
                    type: a.appointment_type,
                    start: toLocal(a.starts_at),
                    minutes: String(Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)),
                    location: a.location ?? "",
                    status: (STATUSES as readonly string[]).includes(a.status) ? (a.status as Status) : "scheduled",
                    note: a.worker_note ?? "",
                  })
                }
              >
                Edit
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={outlookWebInviteUrl(a)} target="_blank" rel="noreferrer">
                  Outlook (web)
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadIcs(a)}>
                Outlook (app)
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
