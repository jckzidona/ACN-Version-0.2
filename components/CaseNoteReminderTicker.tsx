import { Button } from "@/components/ui/button";

const REMINDER_ITEMS = [
  "Client appearance",
  "Client's success",
  "Client's challenges",
  "Follow-up / next steps",
];

/** One full pass of the reminder list. Repeated so the strip always reads as continuous. */
function ReminderCopy({ hidden }: { hidden?: boolean }) {
  return (
    <span className="marquee-copy" aria-hidden={hidden ? "true" : undefined}>
      {Array.from({ length: 4 }).map((_, pass) => (
        <span key={pass} className="inline-flex items-center">
          {REMINDER_ITEMS.map((item) => (
            <span key={`${pass}-${item}`} className="inline-flex items-center">
              <span className="px-4 text-sm font-medium text-foreground lg:text-base">{item}</span>
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Replaces the old blocking pop-up: the same reminder list now scrolls
 * across the top of the case-note form, left to right, without interrupting work.
 */
export function CaseNoteReminderTicker({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <section
      aria-label="Before you start your case note"
      className="mb-4 flex items-stretch overflow-hidden rounded-lg border border-primary/25 bg-primary/5"
    >
      <p className="sr-only">
        Remember to include these details when they apply to the client interaction: client
        appearance, client&apos;s success, client&apos;s challenges, and follow-up or next steps.
      </p>
      <div className="flex shrink-0 items-center gap-2 border-r border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary lg:text-xs">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
        <span className="hidden sm:inline">Before you start</span>
        <span className="sm:hidden">Reminder</span>
      </div>

      <div className="marquee relative flex-1 overflow-hidden py-2">
        <div className="marquee-track">
          <ReminderCopy />
          <ReminderCopy hidden />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Dismiss reminder"
        className="min-h-[44px] shrink-0 rounded-none border-l border-primary/20 px-3 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ×
        </span>
      </Button>
    </section>
  );
}
