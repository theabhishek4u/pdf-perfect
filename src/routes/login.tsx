import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Login — PDF Editify" },
      { name: "description", content: "Sign in to your PDF Editify workspace." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue editing.">
      <button
        onClick={handleGoogle}
        className="mb-4 w-full rounded-xl border border-border bg-white py-3 text-sm font-medium hover:bg-muted"
      >
        Continue with Google
      </button>
      <Divider />
      <form onSubmit={handleEmail} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <button
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="text-foreground underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-reveal">
        <div className="mb-8 text-center">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            PDF <span className="font-serif-italic">Editify</span>
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-white/60 p-8 shadow-[var(--shadow-glass)] backdrop-blur-xl">
          <h1 className="mb-2 text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-border bg-white/80 px-4 py-2.5 text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
