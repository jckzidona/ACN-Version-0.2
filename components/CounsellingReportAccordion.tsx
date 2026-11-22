import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CR_SECTIONS, isVisible, type CrAnswers, type CrQuestion } from "@/lib/counselling-report-schema";

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

function Question({ q, value, onChange }: { q: CrQuestion; value: CrAnswers; onChange: (a: CrAnswers) => void }) {
  const v = value[q.id];
  const set = (x: CrAnswers[string]) => onChange({ ...value, [q.id]: x });
  const otherKey = `${q.id}__other`;
  const showOther = q.otherOption && (Array.isArray(v) ? v.includes(q.otherOption) : v === q.otherOption);
  return (
    <fieldset className="space-y-2 !border-0 !bg-transparent !p-0 !shadow-none">
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        {q.label} {q.required && <span className="text-destructive">*</span>}
      </legend>
      {q.type === "single" && (
        <div className="flex flex-col items-start gap-2">
          {(q.options ?? []).map((o) => (
            <Button
              key={o}
              type="button"
              variant={v === o ? "default" : "outline"}
              aria-pressed={v === o}
              onClick={() => set(v === o ? null : o)}
              className="h-auto whitespace-normal text-left justify-start px-3 py-1.5 text-xs"
            >
              {o}
            </Button>
          ))}
        </div>
      )}
      {q.type === "multi" && (
        <div className="space-y-1.5">
          {(q.options ?? []).map((o) => {
            const list = Array.isArray(v) ? v : [];
            const on = list.includes(o);
            return (
              <label key={o} className="flex items-start gap-2 text-xs text-foreground">
                <Checkbox checked={on} onCheckedChange={(c) => set(c ? [...list, o] : list.filter((x) => x !== o))} className="mt-0.5" />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      )}
      {q.type === "number" && (
        <Input
          type="number" min={0} max={999} className="max-w-[160px] bg-background"
          value={typeof v === "number" ? v : ""}
          onChange={(e) => set(e.target.value === "" ? null : Math.max(0, Math.min(999, Math.floor(Number(e.target.value)))))}
        />
      )}
      {q.type === "text" && (
        <Textarea rows={2} className="bg-background" maxLength={2000} value={typeof v === "string" ? v : ""} onChange={(e) => set(e.target.value)} />
      )}
      {showOther && (
        <Input
          placeholder="Please specify" className="max-w-sm bg-background" maxLength={200}
          value={typeof value[otherKey] === "string" ? (value[otherKey] as string) : ""}
          onChange={(e) => onChange({ ...value, [otherKey]: e.target.value })}
        />
      )}
    </fieldset>
  );
}

export function CounsellingReportAccordion({ value, onChange }: { value: CrAnswers; onChange: (a: CrAnswers) => void }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Counselling — Monthly Activity Report</h3>
        <span className="text-xs text-muted-foreground"><span className="text-destructive">*</span> required before saving</span>
      </div>
      <Accordion type="single" collapsible defaultValue="s0">
        {CR_SECTIONS.map((s, i) => {
          const visible = s.questions.filter((q) => isVisible(q, value));
          const req = visible.filter((q) => q.required);
          const done = req.filter((q) => !empty(value[q.id])).length;
          return (
            <AccordionItem key={s.title} value={`s${i}`} className="rounded-lg px-3">
              <AccordionTrigger className="text-sm">
                <span className="flex flex-1 items-center gap-2 text-left">
                  <span className="section-chip">{i + 1}</span>
                  {s.title}
                  {req.length > 0 && (
                    <span className={`ml-auto mr-2 text-xs font-normal ${done === req.length ? "text-primary" : "text-muted-foreground"}`}>
                      {done}/{req.length}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 rounded-md bg-card p-3">
                  {visible.map((q) => <Question key={q.id} q={q} value={value} onChange={onChange} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

