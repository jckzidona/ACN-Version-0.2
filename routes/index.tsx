import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import workspaceImage from "@/assets/acn-workspace.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ACN — Assistance Case Note — Documentation for frontline teams" },
      {
        name: "description",
        content:
          "Turn raw interaction notes into professional, guardrailed case notes for settlement and counselling teams, with drafts, version history and audit trails.",
      },
      { property: "og:title", content: "ACN — Assistance Case Note" },
      {
        property: "og:description",
        content:
          "Case-note drafting and monthly reporting for settlement and counselling teams, with worker review and role-based access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Sparkles,
    title: "Case-note drafting",
    body: "Type or dictate. Review every AI draft.",
  },
  {
    icon: Users,
    title: "Client records",
    body: "Shared identity. Department-private notes.",
  },
  {
    icon: FileText,
    title: "Monthly reporting",
    body: "Settlement & counselling. Excel and PDF.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled access",
    body: "Organization, role and department controls.",
  },
];

function Landing() {
  return (
    <div className="flex min-h-svh flex-col bg-background tracking-normal">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-3 text-foreground" aria-label="ACN — Assistance Case Note home">
            <FileText className="size-7 text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold">ACN<span className="ml-3 hidden text-sm font-normal text-muted-foreground sm:inline">Assistance Case Note</span></span>
          </Link>
          <Button asChild size="sm" variant="outline" className="min-h-10">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <section className="relative isolate overflow-hidden border-b border-border">
          <img src={workspaceImage} alt="" width={1536} height={768} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
          <div className="absolute inset-0 -z-10 bg-background/45" />
          <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-12 lg:py-16">
            <p className="text-xs font-semibold uppercase text-primary">For settlement &amp; counselling teams</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-4xl lg:text-5xl">
              ACN <span className="block">Assistance Case Note</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground sm:text-base">
              From typed or spoken session notes to professional drafts and monthly reports — with the worker always in control.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="min-h-11">Book a demonstration <ArrowRight className="size-4" aria-hidden="true" /></Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg">
                  <DialogHeader>
                    <DialogTitle className="tracking-normal">Book an ACN demonstration</DialogTitle>
                    <DialogDescription>Tell us about your agency. We'll contact you to arrange a short online demonstration.</DialogDescription>
                  </DialogHeader>
                  <DemoRequestForm />
                </DialogContent>
              </Dialog>
              <Button asChild variant="outline" size="lg" className="min-h-11"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
            </div>
          </div>
        </section>
        <section aria-label="ACN overview" className="bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-5 py-6 sm:px-8 lg:grid-cols-4 lg:py-8">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold tracking-normal text-foreground">{title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <a href="https://mail.google.com/mail/?view=cm&fs=1&to=settlement.acn@gmail.com&su=ACN%20demonstration%20request" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 text-foreground underline-offset-4 hover:underline"><Mail className="size-4 text-primary" aria-hidden="true" />settlement.acn@gmail.com</a>
          <Dialog>
            <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-xs"><ShieldCheck className="size-4" aria-hidden="true" />Privacy &amp; data handling</Button></DialogTrigger>
            <DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
              <DialogHeader>
                <DialogTitle className="tracking-normal">Privacy &amp; data handling</DialogTitle>
                <DialogDescription>Access controls and considerations before adopting ACN.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <div><h3 className="font-semibold tracking-normal text-foreground">Access to records</h3><p className="mt-1">ACN uses managed cloud services for application data and private documents. Access is controlled by organization, role and department. Sharing client identity information does not share sensitive case notes between departments.</p></div>
                <div><h3 className="font-semibold tracking-normal text-foreground">AI processing &amp; adoption</h3><p className="mt-1">Information submitted for AI drafting or voice transcription is processed by external AI services. Confirm hosting locations, provider terms and your agency's privacy requirements before using identifiable client information. Use fictional information for demonstrations.</p></div>
                <p>Every note remains under the worker's review and approval before saving.</p>
              </div>
            </DialogContent>
          </Dialog>
          <p>© 2026 ACN — Assistance Case Note. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
