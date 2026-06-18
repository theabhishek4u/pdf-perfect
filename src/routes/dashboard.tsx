import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, ArrowLeft } from "lucide-react";
import { addPdf } from "@/lib/pdf-store";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — PDF Editify" }] }),
});

function DashboardPage() {
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setUploading(true);
      let firstId: string | null = null;
      for (const file of accepted) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 50MB`);
          continue;
        }
        try {
          const rec = await addPdf(file);
          if (!firstId) firstId = rec.id;
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
      setUploading(false);
      if (firstId) {
        toast.success("Opening editor…");
        navigate({ to: "/editor/$fileId", params: { fileId: firstId } });
      }
    },
    [navigate],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl glass px-4 py-3 shadow-[var(--shadow-glass)] sm:px-5">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground sm:text-sm">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/dashboard" className="justify-self-center text-base font-semibold tracking-tight sm:text-lg">
            PDF <span className="font-serif-italic">Editify</span>
          </Link>
          <div className="flex items-center gap-2 justify-self-end">
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:inline">
              Free · No login
            </span>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-16">
        <div className="mb-8 animate-reveal sm:mb-12">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </span>
          <h1 className="font-display text-4xl font-light leading-[1.05] sm:text-6xl">
            Your <span className="font-serif-italic font-medium">documents</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:mt-4">
            Files are stored privately in your browser. Nothing is uploaded to a server.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card/70 p-3 shadow-editorial backdrop-blur sm:p-6">
          <div className="relative group">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-muted to-background opacity-25 blur transition duration-700 group-hover:opacity-60" />
            <div
              {...getRootProps()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-16 ${
                isDragActive
                  ? "border-foreground bg-card"
                  : "border-border bg-card/40 hover:border-foreground/40 hover:bg-card"
              }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border sm:mb-5">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {uploading
                  ? "Uploading…"
                  : isDragActive
                    ? "Drop PDFs here"
                    : "Drag PDFs here, or tap to browse"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                PDF only · Up to 50MB per file · Stored locally
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
