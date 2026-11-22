import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftFollowUpEmail } from "@/lib/appointments.functions";

function toOutlookDt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

function icsEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

type Mail = { to: string; subject: string; body: string };

export function FollowUpEmail({ noteId }: { noteId: string }) {
  const draft = useServerFn(draftFollowUpEmail);
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState<Mail | null>(null);
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [location, setLocation] = useState("");

  async function generate() {
    setBusy(true);
    try {
      setMail(await draft({ data: { noteId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft the email.");
    } finally {
      setBusy(false);
    }
  }

  const q = (m: Mail) =>
    `to=${encodeURIComponent(m.to)}&subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;

  const startDate = start ? new Date(start) : null;
  const endDate = startDate ? new Date(startDate.getTime() + minutes * 60000) : null;

  function outlookWebInviteUrl(m: Mail) {
    if (!startDate || !endDate) return null;
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: m.subject,
      body: m.body,
      startdt: startDate.toISOString(),
      enddt: endDate.toISOString(),
    });
    if (m.to) params.set("to", m.to);
    if (location) params.set("location", location);
    return `https://outlook.office.com/calendar/deeplink/compose?${params.toString()}`;
  }

  function downloadIcs(m: Mail) {
    if (!startDate || !endDate) {
      toast.error("Pick a date and time for the meeting first.");
      return;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ACN//FollowUp//EN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@acn`,
      `DTSTAMP:${toOutlookDt(new Date())}`,
      `DTSTART:${toOutlookDt(startDate)}`,
      `DTEND:${toOutlookDt(endDate)}`,
      `SUMMARY:${icsEscape(m.subject)}`,
      `DESCRIPTION:${icsEscape(m.body)}`,
      location ? `LOCATION:${icsEscape(location)}` : null,
      m.to ? `ATTENDEE;CN=${icsEscape(m.to)};RSVP=TRUE:mailto:${m.to}` : null,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meeting-invite.ics";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invite downloaded. Open it to add it to your Outlook calendar and send it.");
  }

  const inviteUrl = mail ? outlookWebInviteUrl(mail) : null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Follow-up email</h2>
          <p className="text-xs text-muted-foreground">
            AI writes a short summary of next steps. It opens as a draft in your own Outlook.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
          {busy ? "Drafting…" : mail ? "Redraft" : "Draft follow-up email"}
        </Button>
      </div>

      {mail && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label>To</Label>
            <Input
              value={mail.to}
              placeholder="Client email"
              onChange={(e) => setMail({ ...mail, to: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea rows={9} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a
                href={`https://outlook.office.com/mail/deeplink/compose?${q(mail)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Outlook (web)
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`}
              >
                Open in Outlook app
              </a>
            </Button>
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Meeting invite</h3>
              <p className="text-xs text-muted-foreground">
                Set the meeting details below, then send the invite with the client as attendee.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Date &amp; time</Label>
                <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Length (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value) || 30)}
                />
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input
                  value={location}
                  placeholder="Office / online"
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild disabled={!inviteUrl}>
                {inviteUrl ? (
                  <a href={inviteUrl} target="_blank" rel="noreferrer">
                    Send invite in Outlook (web)
                  </a>
                ) : (
                  <span>Send invite in Outlook (web)</span>
                )}
              </Button>
              <Button variant="outline" onClick={() => downloadIcs(mail)}>
                Open invite in Outlook app
              </Button>
              {!inviteUrl && (
                <p className="w-full text-xs text-muted-foreground">
                  Pick a date and time above to enable the invite.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
