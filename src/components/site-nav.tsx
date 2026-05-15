import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const { user } = useAuth();
  return (
    <nav className="sticky top-0 z-50 px-4 py-4 sm:px-6 animate-reveal">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl glass px-5 py-3 shadow-[var(--shadow-glass)]">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-semibold tracking-tight">
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
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-accent"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-accent"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
