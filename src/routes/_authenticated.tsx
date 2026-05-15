import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl glass px-5 py-3 shadow-[var(--shadow-glass)]">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">
            PDF <span className="font-serif-italic">Editify</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Files
            </Link>
            <span className="hidden text-muted-foreground sm:inline">
              {session.user?.email}
            </span>
            <button
              onClick={() => {
                signOut().then(() => navigate({ to: "/" }));
              }}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
