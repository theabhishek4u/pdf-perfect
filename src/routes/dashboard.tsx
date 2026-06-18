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

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 animate-reveal">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </span>
          <h1 className="text-4xl font-medium tracking-tight">
            Your <span className="font-serif-italic">documents</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Files are stored privately in your browser. Nothing is uploaded to a server.
          </p>
        </div>

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
            isDragActive
              ? "border-foreground bg-white"
              : "border-border bg-white/40 hover:bg-white/70"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-4 size-8 text-muted-foreground" />
          <p className="text-base font-medium">
            {uploading
              ? "Uploading…"
              : isDragActive
                ? "Drop PDFs here"
                : "Drag PDFs here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF only · Up to 50MB per file
          </p>
        </div>
      </main>
    </div>
  );
}
