import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 px-3 py-3 sm:px-6 sm:py-4 animate-reveal">
      <div className="mx-auto max-w-7xl rounded-2xl glass shadow-[var(--shadow-glass)]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-base font-semibold tracking-tight sm:text-lg">
              PDF <span className="font-serif-italic">Editify</span>
            </Link>
            <div className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex">
              <a href="/#tools" className="hover:text-foreground transition-colors">
                Tools
              </a>
              <a href="/#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="/#faq" className="hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="hidden rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 sm:inline-flex"
            >
              Open App
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
              className="inline-flex size-9 items-center justify-center rounded-full border border-border text-foreground md:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium">
              <a onClick={() => setOpen(false)} href="/#tools" className="text-muted-foreground hover:text-foreground">
                Tools
              </a>
              <a onClick={() => setOpen(false)} href="/#pricing" className="text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <a onClick={() => setOpen(false)} href="/#faq" className="text-muted-foreground hover:text-foreground">
                FAQ
              </a>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
              >
                Open App
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
