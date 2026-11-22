import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name").max(120),
  agency: z.string().trim().min(1, "Please enter your agency").max(160),
  role_title: z.string().trim().max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().max(40),
  team_size: z.string().trim().max(40),
  message: z.string().trim().max(2000),
});

type Fields = z.infer<typeof schema>;
const empty: Fields = { full_name: "", agency: "", role_title: "", email: "", phone: "", team_size: "", message: "" };

export function DemoRequestForm() {
  const [form, setForm] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const set = (k: keyof Fields) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof Fields, string>> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as keyof Fields] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setState("sending");
    const d = parsed.data;
    const { error } = await supabase.from("demo_requests").insert({
      full_name: d.full_name,
      agency: d.agency,
      email: d.email,
      role_title: d.role_title || null,
      phone: d.phone || null,
      team_size: d.team_size || null,
      message: d.message || null,
    });
    if (error) return setState("error");
    setForm(empty);
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-border bg-background p-5" role="status">
        <p className="font-semibold text-foreground">Thank you — your request was received.</p>
        <p className="mt-1 text-sm text-muted-foreground">We'll contact you shortly to arrange a demonstration.</p>
      </div>
    );
  }

  const field = (k: keyof Fields, label: string, opts: { type?: string; required?: boolean } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`demo-${k}`}>
        {label}
        {opts.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={`demo-${k}`} type={opts.type ?? "text"} value={form[k]} onChange={set(k)} className="min-h-[44px]" />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("full_name", "Full name", { required: true })}
        {field("agency", "Agency / organization", { required: true })}
        {field("role_title", "Your role")}
        {field("email", "Work email", { type: "email", required: true })}
        {field("phone", "Phone", { type: "tel" })}
        {field("team_size", "Number of workers")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="demo-message">What would you like to see?</Label>
        <Textarea id="demo-message" rows={4} value={form.message} onChange={set("message")} />
      </div>
      {state === "error" && (
        <p className="text-sm text-destructive">Sorry, your request couldn't be sent. Please try again.</p>
      )}
      <Button type="submit" size="lg" className="min-h-[48px] w-full sm:w-auto" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Book a demonstration"}
      </Button>
    </form>
  );
}
