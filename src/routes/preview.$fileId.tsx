import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { pdfjsLib } from "@/lib/pdfjs-setup";
import { getPreview } from "@/lib/preview-store";
import { toast } from "sonner";

export const Route = createFileRoute("/preview/$fileId")({
  ssr: false,
  component: PreviewPage,
  head: () => ({ meta: [{ title: "Preview — PDF Editify" }] }),
});

function PreviewPage() {
  const { fileId } = Route.useParams();
  const navigate = useNavigate();
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  useEffect(() => {
    const item = getPreview(fileId);
    if (!item) {
      toast.error("No preview available — apply edits first.");
      navigate({ to: "/editor/$fileId", params: { fileId } });
      return;
    }
    setData(item);
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: item.bytes.slice() }).promise;
      const imgs: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        imgs.push(canvas.toDataURL("image/png"));
        setPages([...imgs]);
      }
      setLoading(false);
    })();
  }, [fileId, navigate]);

  function handleDownload() {
    if (!data) return;
    const blob = new Blob([data.bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.name.replace(/\.pdf$/i, "") + "-edited.pdf";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/editor/$fileId"
            params={{ fileId }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to editor
          </Link>
          <h1 className="truncate text-base font-medium">Preview — {data?.name}</h1>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
          >
            <Download className="size-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-6 px-4 py-8">
        {loading && pages.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Rendering preview…
          </div>
        )}
        {pages.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Page ${i + 1}`}
            className="block bg-white shadow-xl"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        ))}
        {pages.length > 0 && (
          <button
            onClick={handleDownload}
            className="mt-4 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-accent"
          >
            <Download className="size-4" />
            Download PDF
          </button>
        )}
      </div>
    </div>
  );
}
