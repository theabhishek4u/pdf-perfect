import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, ArrowLeft } from "lucide-react";
import { addPdf } from "@/lib/pdf-store";

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
      <nav className="sticky top-0 z-40 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl glass px-5 py-3 shadow-[var(--shadow-glass)]">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">
            PDF <span className="font-serif-italic">Editify</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Free · No login
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-12 animate-reveal">
          <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </span>
          <h1 className="font-display text-5xl font-light leading-[1.05] sm:text-6xl">
            Your <span className="font-serif-italic font-medium">documents</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Files are stored privately in your browser. Nothing is uploaded to a server.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white/70 p-4 shadow-editorial backdrop-blur sm:p-6">
          <div className="relative group">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-stone-100 to-stone-50 opacity-25 blur transition duration-700 group-hover:opacity-60" />
            <div
              {...getRootProps()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all ${
                isDragActive
                  ? "border-foreground bg-white"
                  : "border-border bg-white/40 hover:border-foreground/40 hover:bg-white"
              }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {uploading
                  ? "Uploading…"
                  : isDragActive
                    ? "Drop PDFs here"
                    : "Drag PDFs here, or click to browse"}
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
