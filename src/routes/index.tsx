import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "PDF Editify — Intelligent document editing" },
      {
        name: "description",
        content:
          "Edit, sign, merge and annotate PDFs with AI precision. The editorial standard for intelligent documents.",
      },
    ],
  }),
});

const tools = [
  { n: "01", title: "Semantic Merge", desc: "Combine PDFs with intelligent table-of-contents alignment." },
  { n: "02", title: "AI Synthesis", desc: "Summarize 500+ pages into executive memos in seconds." },
  { n: "03", title: "Smart Redact", desc: "Automated PII identification and permanent removal." },
  { n: "04", title: "Verified Sign", desc: "Audit-trailed e-signatures with identity verification." },
  { n: "05", title: "Annotate", desc: "Highlight, comment, draw and collaborate in-context." },
  { n: "06", title: "Split & Extract", desc: "Pull pages or ranges into clean standalone files." },
  { n: "07", title: "OCR", desc: "Scanned pages become searchable, editable text." },
  { n: "08", title: "Convert", desc: "PDF ↔ Word, image, and back. Layout preserved." },
];

const faqs = [
  {
    q: "Is my data private?",
    a: "Files stay in your browser by default. We never upload your documents or train models on your content.",
  },
  {
    q: "What file types are supported?",
    a: "PDF natively, plus DOCX and image inputs that convert to PDF on upload.",
  },
  {
    q: "Is it really free?",
    a: "Yes — the core editor is free forever. No login, no credit card.",
  },
  {
    q: "Do you offer team accounts?",
    a: "Team workspaces with shared folders and roles are on the roadmap.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen text-foreground">
      <SiteNav />

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-5 pt-12 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
        <div className="animate-reveal [animation-delay:100ms]">
          <span className="mb-5 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mb-6">
            Intelligence in format
          </span>
          <h1 className="font-display mb-6 text-balance text-4xl font-light leading-[1.05] sm:mb-8 sm:text-6xl md:text-7xl">
            The editorial standard for{" "}
            <span className="font-serif-italic font-medium">intelligent</span> documents.
          </h1>
          <p className="mx-auto mb-8 max-w-[55ch] text-pretty text-base leading-relaxed text-muted-foreground sm:mb-10 sm:text-xl">
            Transcend basic editing. An AI-augmented workspace designed for clarity,
            security, and professional precision.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link
              to="/dashboard"
              className="rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-xl transition-all hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
            >
              Edit with AI Now
            </Link>
            <a
              href="#tools"
              className="rounded-full border border-border bg-card/60 px-7 py-3.5 text-base font-medium text-foreground backdrop-blur transition-all hover:bg-card sm:px-8 sm:py-4 sm:text-lg"
            >
              Explore Tools
            </a>
          </div>
        </div>

        {/* Editor Preview */}
        <div className="relative mt-12 animate-reveal [animation-delay:300ms] sm:mt-20">
          <div className="rounded-3xl border border-border bg-card/40 p-2 shadow-2xl backdrop-blur-2xl sm:rounded-[2rem] sm:p-3">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-background outline outline-1 -outline-offset-1 outline-border sm:aspect-video">
              <MockEditor />
            </div>
          </div>
        </div>
      </header>

      {/* Tool Grid */}
      <section id="tools" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 max-w-2xl sm:mb-12">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mb-4">
            The toolkit
          </span>
          <h2 className="font-display text-3xl font-light sm:text-5xl">
            Every action you need, none you don't.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:rounded-3xl md:grid-cols-4">
          {tools.map((t) => (
            <div
              key={t.n}
              className="group bg-card/80 p-6 transition-all hover:bg-card sm:p-8"
            >
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mb-6">
                {t.n}
              </div>
              <h3 className="mb-2 text-sm font-medium tracking-tight sm:mb-3 sm:text-base">{t.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-border bg-card/20 py-14 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 px-5 sm:px-6 md:flex-row md:gap-12">
          <div className="max-w-md text-center md:text-left">
            <h2 className="font-display mb-3 text-2xl font-light sm:mb-4 sm:text-3xl">
              Bank-grade security as the default.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              AES-256 encryption at rest, isolated per-user storage, and
              zero-knowledge architecture by design.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50 grayscale sm:gap-12">
            {["FORTUNA", "AETHER", "LUMENS", "KINETIC"].map((b) => (
              <span key={b} className="text-base font-bold tracking-tighter sm:text-xl">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-32">
        <div className="mb-12 text-center sm:mb-16">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mb-4">
            Pricing
          </span>
          <h2 className="font-display text-3xl font-light sm:text-5xl">
            Simple tiers for serious work.
          </h2>
        </div>
        <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
          <PricingCard
            tier="Basic"
            price="$0"
            features={["3 PDFs / day", "Basic AI summaries", "Annotation & sign", "Web access"]}
            cta="Start for free"
            href="/dashboard"
          />
          <PricingCard
            tier="Professional"
            price="$19"
            suffix="/mo"
            highlight
            features={["Unlimited AI", "Priority OCR", "Custom branding", "Audit trails", "Cloud storage"]}
            cta="Go Pro"
            href="/dashboard"
          />
          <PricingCard
            tier="Enterprise"
            price="Custom"
            features={["SSO & SCIM", "Dedicated success", "Air-gapped deployment", "Team workspaces"]}
            cta="Talk to sales"
            href="/dashboard"
          />
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-6 sm:pb-24">
        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {[
            {
              q: "Replaced three tools the moment our legal team tried it.",
              n: "Mara Chen",
              r: "Head of Operations, Lumens",
            },
            {
              q: "The AI summary is uncanny. Saves me an hour every brief.",
              n: "Daniyar O.",
              r: "Senior Counsel",
            },
            {
              q: "Finally, a PDF editor that doesn't look like 2008.",
              n: "Priya Raman",
              r: "Design Director",
            },
          ].map((t) => (
            <figure
              key={t.n}
              className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur sm:rounded-3xl sm:p-8"
            >
              <blockquote className="mb-5 text-base leading-relaxed sm:mb-6 sm:text-lg">
                <span className="font-serif-italic text-2xl">"</span>
                {t.q}
              </blockquote>
              <figcaption className="text-xs text-muted-foreground">
                <span className="block font-medium text-foreground">{t.n}</span>
                {t.r}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-24 sm:px-6 sm:pb-32">
        <div className="mb-10 text-center sm:mb-12">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl font-light sm:text-5xl">
            Questions, answered.
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`f-${i}`}
              className="rounded-2xl border border-border bg-card/40 px-5 backdrop-blur sm:px-6"
            >
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline sm:text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-6 sm:pb-32">
        <div className="rounded-3xl bg-primary p-10 text-center text-primary-foreground shadow-2xl sm:rounded-[2rem] sm:p-16">
          <h2 className="font-display mb-4 text-3xl font-light sm:mb-6 sm:text-5xl">
            Begin with a single document.
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-primary-foreground/70 sm:mb-8 sm:text-base">
            Free to start. No credit card. Just upload and edit.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex rounded-full bg-background px-7 py-3.5 text-sm font-medium text-foreground hover:opacity-90 sm:px-8 sm:py-4 sm:text-base"
          >
            Open the app — free
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function PricingCard({
  tier,
  price,
  suffix,
  features,
  cta,
  href,
  highlight,
}: {
  tier: string;
  price: string;
  suffix?: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-8 transition-all sm:rounded-[2rem] sm:p-10 ${
        highlight
          ? "bg-primary text-primary-foreground shadow-editorial md:scale-[1.03]"
          : "border border-border bg-card/60 backdrop-blur hover:bg-card"
      }`}
    >
      {highlight && (
        <span className="absolute right-5 top-5 rounded-full bg-primary-foreground/15 px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-primary-foreground/80 sm:right-6 sm:top-6">
          Most popular
        </span>
      )}
      <span
        className={`mb-6 font-mono text-[10px] uppercase tracking-[0.2em] sm:mb-8 ${
          highlight ? "text-primary-foreground/60" : "text-muted-foreground"
        }`}
      >
        {tier}
      </span>
      <div className="font-display mb-8 text-4xl font-light sm:mb-10 sm:text-5xl">
        {price}
        {suffix && (
          <span
            className={`ml-1 text-base font-light sm:text-lg ${
              highlight ? "text-primary-foreground/50" : "text-muted-foreground"
            }`}
          >
            {suffix}
          </span>
        )}
      </div>
      <ul
        className={`mb-10 flex-grow space-y-3 text-sm sm:mb-12 sm:space-y-4 ${
          highlight ? "text-primary-foreground/85" : "text-muted-foreground"
        }`}
      >
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className={`mt-1.5 size-1 rounded-full ${highlight ? "bg-primary-foreground/50" : "bg-foreground/30"}`} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={href}
        className={`w-full rounded-xl py-3.5 text-center text-sm font-medium transition-all ${
          highlight
            ? "bg-background text-foreground hover:opacity-90"
            : "border border-border bg-background hover:border-foreground"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function MockEditor() {
  return (
    <div className="flex h-full">
      <div className="hidden w-40 border-r border-border/50 bg-card/30 p-4 sm:block lg:w-48">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded border border-border/50 bg-card/60"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto h-full max-w-md rounded border border-border/50 bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-foreground/80" />
            <div className="h-2 w-full rounded bg-foreground/15" />
            <div className="h-2 w-5/6 rounded bg-foreground/15" />
            <div className="h-2 w-full rounded bg-yellow-300/60" />
            <div className="h-2 w-4/5 rounded bg-foreground/15" />
            <div className="mt-4 h-2 w-2/3 rounded bg-foreground/15" />
            <div className="h-2 w-3/4 rounded bg-foreground/15" />
          </div>
        </div>
      </div>
      <div className="hidden w-56 border-l border-border/50 bg-card/30 p-4 lg:block">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          AI Summary
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-foreground/15" />
          <div className="h-2 w-5/6 rounded bg-foreground/15" />
          <div className="h-2 w-full rounded bg-foreground/15" />
          <div className="h-2 w-3/4 rounded bg-foreground/15" />
        </div>
      </div>
    </div>
  );
}
