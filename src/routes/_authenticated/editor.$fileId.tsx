import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfjs-setup";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import {
  ArrowLeft,
  Type,
  Highlighter,
  PenTool,
  Download,
  Save,
  Scissors,
  Plus,
  RotateCw,
  Trash2,
  Loader2,
  Edit3,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/editor/$fileId")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — PDF Editify" }] }),
});

type Tool = "select" | "text" | "highlight" | "sign" | "edit";

type TextBox = { x: number; y: number; w: number; h: number; size: number; str: string };

type Annotation =
  | { type: "text"; page: number; x: number; y: number; text: string; size: number }
  | { type: "highlight"; page: number; x: number; y: number; w: number; h: number }
  | { type: "image"; page: number; x: number; y: number; w: number; h: number; dataUrl: string }
  | { type: "edit"; page: number; x: number; y: number; w: number; h: number; size: number; text: string };

function EditorPage() {
  const { fileId } = Route.useParams();
  const navigate = useNavigate();
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("document.pdf");
  const [storagePath, setStoragePath] = useState("");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [showSig, setShowSig] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [pageTextBoxes, setPageTextBoxes] = useState<TextBox[][]>([]);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Load file
  useEffect(() => {
    (async () => {
      const { data: row, error } = await supabase
        .from("pdf_files")
        .select("*")
        .eq("id", fileId)
        .single();
      if (error || !row) {
        toast.error("File not found");
        navigate({ to: "/dashboard" });
        return;
      }
      setFileName(row.name);
      setStoragePath(row.storage_path);
      const { data: dl, error: dlErr } = await supabase.storage
        .from("pdfs")
        .download(row.storage_path);
      if (dlErr || !dl) {
        toast.error("Could not load PDF");
        return;
      }
      const buf = new Uint8Array(await dl.arrayBuffer());
      setPdfBytes(buf);
      await renderPdf(buf);
      setLoading(false);
    })();
  }, [fileId, navigate]);

  async function renderPdf(buf: Uint8Array) {
    const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
    const imgs: string[] = [];
    const sizes: { w: number; h: number }[] = [];
    const allBoxes: TextBox[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      imgs.push(canvas.toDataURL("image/png"));
      sizes.push({ w: viewport.width, h: viewport.height });

      // Extract text positions in canvas pixel coords
      const tc = await page.getTextContent();
      const boxes: TextBox[] = [];
      for (const it of tc.items as any[]) {
        if (!it.str || !it.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        const width = (it.width || 0) * viewport.scale;
        const left = tx[4];
        const top = tx[5] - fontHeight;
        boxes.push({ x: left, y: top, w: width, h: fontHeight, size: fontHeight, str: it.str });
      }
      allBoxes.push(boxes);
    }
    setPageImages(imgs);
    setPageSizes(sizes);
    setPageTextBoxes(allBoxes);
    setPageRotations(new Array(imgs.length).fill(0));
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "text") {
      const text = prompt("Enter text:");
      if (!text) return;
      setAnnotations((a) => [
        ...a,
        { type: "text", page: currentPage, x, y, text, size: 16 },
      ]);
    } else if (tool === "highlight") {
      setAnnotations((a) => [
        ...a,
        {
          type: "highlight",
          page: currentPage,
          x,
          y: y - 8,
          w: 120,
          h: 16,
        },
      ]);
    } else if (tool === "sign" && pendingSig) {
      setAnnotations((a) => [
        ...a,
        {
          type: "image",
          page: currentPage,
          x,
          y,
          w: 140,
          h: 50,
          dataUrl: pendingSig,
        },
      ]);
    }
  }

  async function buildEditedPdf(): Promise<Uint8Array> {
    if (!pdfBytes) throw new Error("No PDF");
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();

    // Apply rotations
    pageRotations.forEach((rot, i) => {
      if (rot && pages[i]) {
        const current = pages[i].getRotation().angle;
        pages[i].setRotation(degrees((current + rot) % 360));
      }
    });

    // Apply annotations
    for (const ann of annotations) {
      const page = pages[ann.page];
      if (!page) continue;
      const { width: pw, height: ph } = page.getSize();
      const rendered = pageSizes[ann.page];
      if (!rendered) continue;
      const sx = pw / rendered.w;
      const sy = ph / rendered.h;

      if (ann.type === "text") {
        page.drawText(ann.text, {
          x: ann.x * sx,
          y: ph - ann.y * sy - ann.size,
          size: ann.size,
          font,
          color: rgb(0, 0, 0),
        });
      } else if (ann.type === "highlight") {
        page.drawRectangle({
          x: ann.x * sx,
          y: ph - (ann.y + ann.h) * sy,
          width: ann.w * sx,
          height: ann.h * sy,
          color: rgb(1, 0.92, 0.23),
          opacity: 0.4,
        });
      } else if (ann.type === "image") {
        const png = await doc.embedPng(ann.dataUrl);
        page.drawImage(png, {
          x: ann.x * sx,
          y: ph - (ann.y + ann.h) * sy,
          width: ann.w * sx,
          height: ann.h * sy,
        });
      } else if (ann.type === "edit") {
        // Cover original text with white, then draw new text
        const pad = 2;
        page.drawRectangle({
          x: ann.x * sx - pad,
          y: ph - (ann.y + ann.h) * sy - pad,
          width: ann.w * sx + pad * 2,
          height: ann.h * sy + pad * 2,
          color: rgb(1, 1, 1),
        });
        const size = ann.size * sy;
        page.drawText(ann.text, {
          x: ann.x * sx,
          y: ph - ann.y * sy - size,
          size,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
    return await doc.save();
  }

  async function handleDownload() {
    setSaving(true);
    try {
      const out = await buildEditedPdf();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const out = await buildEditedPdf();
      const { error } = await supabase.storage
        .from("pdfs")
        .upload(storagePath, new Blob([out as BlobPart], { type: "application/pdf" }), {
          upsert: true,
          contentType: "application/pdf",
        });
      if (error) throw error;
      await supabase
        .from("pdf_files")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", fileId);
      // Reload
      setPdfBytes(out);
      await renderPdf(out);
      setAnnotations([]);
      toast.success("Saved to your workspace");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function handleSplitCurrent() {
    if (!pdfBytes) return;
    const src = await PDFDocument.load(pdfBytes);
    const out = await PDFDocument.create();
    const [p] = await out.copyPages(src, [currentPage]);
    out.addPage(p);
    const bytes = await out.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `page-${currentPage + 1}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Page ${currentPage + 1} extracted`);
  }

  async function handleMerge(file: File) {
    if (!pdfBytes) return;
    setSaving(true);
    try {
      const src = await PDFDocument.load(pdfBytes);
      const extra = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
      const copied = await src.copyPages(extra, extra.getPageIndices());
      copied.forEach((p) => src.addPage(p));
      const bytes = await src.save();
      setPdfBytes(bytes);
      await renderPdf(bytes);
      toast.success(`Merged ${extra.getPageCount()} pages`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  function rotateCurrent() {
    setPageRotations((r) => {
      const n = [...r];
      n[currentPage] = (n[currentPage] + 90) % 360;
      return n;
    });
  }

  async function deleteCurrent() {
    if (!pdfBytes || pageImages.length <= 1) {
      toast.error("Cannot delete the only page");
      return;
    }
    if (!confirm(`Delete page ${currentPage + 1}?`)) return;
    const src = await PDFDocument.load(pdfBytes);
    src.removePage(currentPage);
    const bytes = await src.save();
    setPdfBytes(bytes);
    await renderPdf(bytes);
    setAnnotations((a) => a.filter((x) => x.page !== currentPage));
    setCurrentPage((p) => Math.max(0, p - 1));
  }

  const cursor =
    tool === "text"
      ? "text"
      : tool === "highlight"
        ? "crosshair"
        : tool === "sign"
          ? "copy"
          : "default";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {showSig && (
        <SignaturePad
          onCancel={() => setShowSig(false)}
          onSave={(d) => {
            setPendingSig(d);
            setTool("sign");
            setShowSig(false);
            toast.success("Click on the page to place");
          }}
        />
      )}

      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <h1 className="truncate text-base font-medium">{fileName}</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <button
            onClick={handleDownload}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50"
          >
            <Download className="size-4" />
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-96 place-items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading document…
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Page thumbnails */}
          <aside className="col-span-12 lg:col-span-2">
            <div className="rounded-2xl border border-border bg-white/40 p-3 backdrop-blur">
              <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Pages
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto lg:max-h-[80vh]">
                {pageImages.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`overflow-hidden rounded-lg border-2 transition-all ${
                      i === currentPage
                        ? "border-foreground"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <img src={src} alt={`Page ${i + 1}`} className="w-full" />
                    <div className="bg-white py-1 text-[10px] text-muted-foreground">
                      {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Canvas */}
          <main className="col-span-12 lg:col-span-8">
            <div className="overflow-auto rounded-2xl border border-border bg-stone-100 p-6">
              {pageImages[currentPage] && (
                <div
                  ref={overlayRef}
                  onClick={handleCanvasClick}
                  className="relative mx-auto inline-block bg-white shadow-xl"
                  style={{ cursor }}
                >
                  <img
                    src={pageImages[currentPage]}
                    alt=""
                    style={{
                      transform: `rotate(${pageRotations[currentPage] || 0}deg)`,
                    }}
                  />
                  {/* Clickable text boxes when editing existing text */}
                  {tool === "edit" &&
                    (pageTextBoxes[currentPage] || []).map((b, i) => (
                      <button
                        key={`tb-${i}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = prompt("Edit text:", b.str);
                          if (next === null) return;
                          setAnnotations((a) => [
                            ...a,
                            {
                              type: "edit",
                              page: currentPage,
                              x: b.x,
                              y: b.y,
                              w: b.w,
                              h: b.h,
                              size: b.size,
                              text: next,
                            },
                          ]);
                        }}
                        className="absolute border border-dashed border-primary/60 bg-primary/5 hover:bg-primary/20"
                        style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                        title={b.str}
                      />
                    ))}
                  {annotations
                    .filter((a) => a.page === currentPage)
                    .map((a, i) => {
                      if (a.type === "text")
                        return (
                          <span
                            key={i}
                            className="absolute font-sans text-black"
                            style={{
                              left: a.x,
                              top: a.y,
                              fontSize: a.size,
                              pointerEvents: "none",
                            }}
                          >
                            {a.text}
                          </span>
                        );
                      if (a.type === "highlight")
                        return (
                          <div
                            key={i}
                            className="absolute bg-yellow-300/40"
                            style={{
                              left: a.x,
                              top: a.y,
                              width: a.w,
                              height: a.h,
                              pointerEvents: "none",
                            }}
                          />
                        );
                      if (a.type === "edit")
                        return (
                          <div
                            key={i}
                            className="absolute flex items-center bg-white font-sans text-black"
                            style={{
                              left: a.x - 2,
                              top: a.y - 2,
                              width: a.w + 4,
                              height: a.h + 4,
                              fontSize: a.size,
                              lineHeight: `${a.h}px`,
                              pointerEvents: "none",
                            }}
                          >
                            {a.text}
                          </div>
                        );
                      return (
                        <img
                          key={i}
                          src={a.dataUrl}
                          alt=""
                          className="absolute"
                          style={{
                            left: a.x,
                            top: a.y,
                            width: a.w,
                            height: a.h,
                            pointerEvents: "none",
                          }}
                        />
                      );
                    })}
                </div>
              )}
            </div>
            <div className="mt-3 text-center font-mono text-xs text-muted-foreground">
              Page {currentPage + 1} of {pageImages.length}
            </div>
          </main>

          {/* Tools */}
          <aside className="col-span-12 lg:col-span-2">
            <div className="space-y-2 rounded-2xl border border-border bg-white/40 p-3 backdrop-blur">
              <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Tools
              </div>
              <ToolBtn
                icon={<Edit3 className="size-4" />}
                label="Edit text"
                active={tool === "edit"}
                onClick={() => setTool(tool === "edit" ? "select" : "edit")}
              />
              <ToolBtn
                icon={<Type className="size-4" />}
                label="Add text"
                active={tool === "text"}
                onClick={() => setTool(tool === "text" ? "select" : "text")}
              />
              <ToolBtn
                icon={<Highlighter className="size-4" />}
                label="Highlight"
                active={tool === "highlight"}
                onClick={() => setTool(tool === "highlight" ? "select" : "highlight")}
              />
              <ToolBtn
                icon={<PenTool className="size-4" />}
                label="Sign"
                active={tool === "sign"}
                onClick={() => setShowSig(true)}
              />

              <div className="my-3 h-px bg-border" />

              <ToolBtn
                icon={<RotateCw className="size-4" />}
                label="Rotate page"
                onClick={rotateCurrent}
              />
              <ToolBtn
                icon={<Scissors className="size-4" />}
                label="Extract page"
                onClick={handleSplitCurrent}
              />
              <ToolBtn
                icon={<Trash2 className="size-4" />}
                label="Delete page"
                onClick={deleteCurrent}
              />

              <div className="my-3 h-px bg-border" />

              <label className="block">
                <div className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-white">
                  <Plus className="size-4" />
                  <span>Merge PDF</span>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleMerge(f);
                  }}
                />
              </label>

              {annotations.length > 0 && (
                <button
                  onClick={() => setAnnotations([])}
                  className="mt-3 w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:bg-white"
                >
                  Clear annotations
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
