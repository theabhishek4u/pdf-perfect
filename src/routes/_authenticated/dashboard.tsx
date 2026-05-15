import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Star,
  Trash2,
  Search,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — PDF Editify" }] }),
});

type PdfRow = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  is_favorite: boolean;
  created_at: string;
};

function DashboardPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<PdfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pdf_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setFiles((data as PdfRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!user) return;
      setUploading(true);
      for (const file of accepted) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 25MB`);
          continue;
        }
        const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("pdfs")
          .upload(path, file, { contentType: "application/pdf" });
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        const { error: insErr } = await supabase.from("pdf_files").insert({
          user_id: user.id,
          name: file.name,
          storage_path: path,
          size_bytes: file.size,
        });
        if (insErr) toast.error(insErr.message);
      }
      setUploading(false);
      toast.success("Uploaded");
      refresh();
    },
    [user, refresh],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  async function handleDelete(f: PdfRow) {
    if (!confirm(`Delete ${f.name}?`)) return;
    await supabase.storage.from("pdfs").remove([f.storage_path]);
    await supabase.from("pdf_files").delete().eq("id", f.id);
    toast.success("Deleted");
    refresh();
  }

  async function toggleFav(f: PdfRow) {
    await supabase
      .from("pdf_files")
      .update({ is_favorite: !f.is_favorite })
      .eq("id", f.id);
    refresh();
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-10 animate-reveal">
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Workspace
        </span>
        <h1 className="text-4xl font-medium tracking-tight">
          Your <span className="font-serif-italic">documents</span>
        </h1>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`mb-10 cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
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
          PDF only · Up to 25MB per file
        </p>
      </div>

      {/* Search */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-white/60 px-4 py-2.5 backdrop-blur">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Files */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-white/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white/40 p-16 text-center">
          <Sparkles className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h3 className="font-medium">No documents yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload your first PDF to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="group rounded-2xl border border-border bg-white/60 p-5 backdrop-blur transition-all hover:bg-white"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/5">
                  <FileText className="size-5" />
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => toggleFav(f)}
                    className="rounded-lg p-1.5 hover:bg-muted"
                  >
                    <Star
                      className={`size-4 ${f.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    className="rounded-lg p-1.5 hover:bg-muted"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <Link
                to="/editor/$fileId"
                params={{ fileId: f.id }}
                className="block"
              >
                <div className="mb-1 truncate font-medium" title={f.name}>
                  {f.name}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(f.size_bytes / 1024).toFixed(0)} KB</span>
                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
