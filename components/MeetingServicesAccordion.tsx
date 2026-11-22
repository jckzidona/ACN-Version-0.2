import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Optional services given during a one-on-one meeting or home visit.
 */
export type MeetingServices = {
  busTokens: number | null;
  emergencyFood: boolean | null;
  mealProvided: boolean | null;
  childmindingCount: number | null;
  prInfo: string | null;
  dateOfBirth: string | null;
  clientLanguage: string | null;
  interpretationNeeded: boolean | null;
  note: string | null;
  childClientIds: string[];
};

export const EMPTY_MEETING_SERVICES: MeetingServices = {
  busTokens: null, emergencyFood: null, mealProvided: null, childmindingCount: null,
  prInfo: null, dateOfBirth: null, clientLanguage: null, interpretationNeeded: null, note: null, childClientIds: [],
};

const NONE = "__none";
const NUMS = Array.from({ length: 10 }, (_, i) => String(i + 1));
const yn = (v: boolean | null) => (v === null ? NONE : v ? "yes" : "no");
const toYn = (v: string) => (v === NONE ? null : v === "yes");

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Blank</SelectItem>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
const YN = [{ v: "yes", l: "Yes" }, { v: "no", l: "No" }];
const NUM_OPTS = NUMS.map((n) => ({ v: n, l: n }));

export function MeetingServicesAccordion({ value, onChange }: { value: MeetingServices; onChange: (v: MeetingServices) => void }) {
  const hasRecordedService = value.busTokens !== null || value.emergencyFood !== null || value.mealProvided !== null || value.childmindingCount !== null;
  const [enabled, setEnabled] = useState(hasRecordedService);
  const [open, setOpen] = useState(hasRecordedService);
  const set = (patch: Partial<MeetingServices>) => onChange({ ...value, ...patch });

  const toggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    setOpen(checked);
    if (!checked) {
      set({ busTokens: null, emergencyFood: null, mealProvided: null, childmindingCount: null });
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-l-4 border-section-navy-line border-l-section-navy-deep bg-section-navy">
      <div className="flex min-h-12 items-center gap-3 px-4 py-3">
        <Checkbox
          id="services-provided"
          checked={enabled}
          onCheckedChange={(checked) => toggleEnabled(checked === true)}
          aria-label="Services Provided"
        />
        <Label htmlFor="services-provided" className="flex-1 cursor-pointer text-sm font-semibold text-section-navy-ink">
          Services Provided
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={open ? "Close Services Provided" : "Open Services Provided"}
          aria-expanded={open}
          disabled={!enabled}
          className="size-8 text-section-navy-ink disabled:cursor-not-allowed disabled:opacity-35"
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>
      {open && enabled && (
        <div className="grid gap-3 border-t border-section-navy-line bg-card p-4 sm:grid-cols-2">
          <Pick label="Bus tokens" value={value.busTokens ? String(value.busTokens) : NONE} onChange={(v) => set({ busTokens: v === NONE ? null : Number(v) })} options={NUM_OPTS} />
          <Pick label="Emergency food" value={yn(value.emergencyFood)} onChange={(v) => set({ emergencyFood: toYn(v) })} options={YN} />
          <Pick label="Meal or snack provided" value={yn(value.mealProvided)} onChange={(v) => set({ mealProvided: toYn(v) })} options={YN} />
          <Pick label="# children needing childminding" value={value.childmindingCount ? String(value.childmindingCount) : NONE} onChange={(v) => set({ childmindingCount: v === NONE ? null : Number(v) })} options={NUM_OPTS} />
        </div>
      )}
    </div>
  );
}
