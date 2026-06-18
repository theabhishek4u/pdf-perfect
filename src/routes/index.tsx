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
    a: "Files are stored encrypted and isolated per user. You can delete any document at any time and we never train models on your content.",
  },
  {
    q: "What file types are supported?",
    a: "PDF natively, plus DOCX and image inputs that convert to PDF on upload.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — subscriptions are month-to-month and you keep access until the end of the billing period.",
  },
  {
    q: "Do you offer team accounts?",
    a: "Yes. The Business tier includes shared workspaces, role permissions, and consolidated billing.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen text-foreground">
      <SiteNav />

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <div className="animate-reveal [animation-delay:100ms]">
          <span className="mb-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Intelligence in format
          </span>
          <h1 className="font-display mb-8 text-balance text-5xl font-light leading-[1.05] sm:text-6xl md:text-7xl">
            The editorial standard for{" "}
            <span className="font-serif-italic font-medium">intelligent</span> documents.
          </h1>
          <p className="mx-auto mb-10 max-w-[55ch] text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Transcend basic editing. An AI-augmented workspace designed for clarity,
            security, and professional precision.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/dashboard"
              className="rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-xl transition-all hover:bg-accent sm:text-lg"
            >
              Edit with AI Now
            </Link>
            <a
              href="#tools"
              className="rounded-full border border-border bg-white/40 px-8 py-4 text-base font-medium backdrop-blur transition-all hover:bg-white sm:text-lg"
            >
              Explore Tools
            </a>
          </div>
        </div>

        {/* Editor Preview */}
        <div className="relative mt-20 animate-reveal [animation-delay:300ms]">
          <div className="rounded-[2rem] border border-white/60 bg-white/40 p-3 shadow-2xl backdrop-blur-2xl">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-stone-50 to-stone-100 outline outline-1 -outline-offset-1 outline-black/5">
              <MockEditor />
            </div>
          </div>
        </div>
      </header>

      {/* Tool Grid */}
      <section id="tools" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <span className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            The toolkit
          </span>
          <h2 className="font-display text-4xl font-light sm:text-5xl">
            Every action you need, none you don't.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-4">
          {tools.map((t) => (
            <div
              key={t.n}
              className="group bg-white/80 p-8 transition-all hover:bg-white"
            >
              <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t.n}
              </div>
              <h3 className="mb-3 text-base font-medium tracking-tight">{t.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-border bg-white/20 py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 px-6 md:flex-row">
          <div className="max-w-md">
            <h2 className="font-display mb-4 text-3xl font-light">
              Bank-grade security as the default.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              AES-256 encryption at rest, isolated per-user storage, and
              zero-knowledge architecture by design.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
            {["FORTUNA", "AETHER", "LUMENS", "KINETIC"].map((b) => (
              <span key={b} className="text-xl font-bold tracking-tighter">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-32">
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Pricing
          </span>
          <h2 className="font-display text-5xl font-light">
            Simple tiers for serious work.
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
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
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
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
              className="rounded-3xl border border-border bg-white/40 p-8 backdrop-blur"
            >
              <blockquote className="mb-6 text-lg leading-relaxed">
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
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-32">
        <div className="mb-12 text-center">
          <span className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            FAQ
          </span>
          <h2 className="text-4xl font-medium tracking-tight">
            Questions, answered.
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`f-${i}`}
              className="rounded-2xl border border-border bg-white/40 px-6 backdrop-blur"
            >
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
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
      <section className="mx-auto max-w-5xl px-6 pb-32">
        <div className="rounded-[2rem] bg-primary p-16 text-center text-primary-foreground shadow-2xl">
          <h2 className="mb-6 text-4xl font-medium tracking-tight">
            Begin with a single document.
          </h2>
          <p className="mx-auto mb-8 max-w-md text-primary-foreground/70">
            Free to start. No credit card. Just upload and edit.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex rounded-full bg-paper px-8 py-4 text-base font-medium text-ink hover:bg-white"
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
      className={`flex flex-col rounded-[2rem] p-10 ${
        highlight
          ? "scale-105 bg-primary text-primary-foreground shadow-2xl"
          : "border border-border bg-white/30 backdrop-blur"
      }`}
    >
      <span
        className={`mb-4 font-mono text-xs uppercase tracking-widest ${
          highlight ? "text-primary-foreground/60" : "text-muted-foreground"
        }`}
      >
        {tier}
      </span>
      <div className="mb-6 text-4xl font-medium">
        {price}
        {suffix && (
          <span
            className={`text-lg font-normal ${
              highlight ? "text-primary-foreground/60" : "text-muted-foreground"
            }`}
          >
            {suffix}
          </span>
        )}
      </div>
      <ul
        className={`mb-10 flex-grow space-y-3 text-sm ${
          highlight ? "text-primary-foreground/80" : "text-muted-foreground"
        }`}
      >
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Link
        to={href}
        className={`w-full rounded-xl py-3 text-center font-medium transition-all ${
          highlight
            ? "bg-paper text-ink hover:bg-white"
            : "border border-foreground hover:bg-foreground hover:text-background"
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
      <div className="hidden w-48 border-r border-border/50 bg-white/30 p-4 sm:block">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded border border-border/50 bg-white/60"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="mx-auto h-full max-w-md rounded border border-border/50 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-foreground/80" />
            <div className="h-2 w-full rounded bg-foreground/10" />
            <div className="h-2 w-5/6 rounded bg-foreground/10" />
            <div className="h-2 w-full rounded bg-yellow-200/80" />
            <div className="h-2 w-4/5 rounded bg-foreground/10" />
            <div className="mt-4 h-2 w-2/3 rounded bg-foreground/10" />
            <div className="h-2 w-3/4 rounded bg-foreground/10" />
          </div>
        </div>
      </div>
      <div className="hidden w-56 border-l border-border/50 bg-white/30 p-4 lg:block">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          AI Summary
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-foreground/10" />
          <div className="h-2 w-5/6 rounded bg-foreground/10" />
          <div className="h-2 w-full rounded bg-foreground/10" />
          <div className="h-2 w-3/4 rounded bg-foreground/10" />
        </div>
      </div>
    </div>
  );
}
