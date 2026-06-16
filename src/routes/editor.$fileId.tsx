import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont } from "pdf-lib";
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
  MousePointer2,
} from "lucide-react";
import { getPdf, updatePdf } from "@/lib/pdf-store";

export const Route = createFileRoute("/editor/$fileId")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — PDF Editify" }] }),
});

type Tool = "select" | "edit" | "text" | "highlight" | "sign";

// A single text run extracted from the PDF page. Coordinates are in CSS pixels
// of the rendered page (1:1 with the displayed image).
type TextItem = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  background: { r: number; g: number; b: number };
  originalStr: string;
  str: string;
};

type Annotation =
  | { id: string; type: "text"; page: number; x: number; y: number; text: string; size: number }
  | { id: string; type: "highlight"; page: number; x: number; y: number; w: number; h: number }
  | {
      id: string;
      type: "image";
      page: number;
      x: number;
      y: number;
      w: number;
      h: number;
      dataUrl: string;
    };

type PdfTextStyle = { fontFamily?: string; ascent?: number; descent?: number };
type PdfTextContentItem = { str?: string; width?: number; transform: number[]; fontName: string };

const RENDER_SCALE = 1.5;

function inferFontInfo(rawName: string) {
  const name = rawName.toLowerCase();
  const isSerif = /times|serif|roman/.test(name);
  const isMono = /courier|mono|code/.test(name);
  return {
    family: isSerif
      ? "Times New Roman, Times, serif"
      : isMono
        ? "Courier New, Courier, monospace"
        : "Helvetica, Arial, sans-serif",
    weight: /bold|black|heavy|semibold|demi/.test(name) ? 700 : 400,
    style: /italic|oblique/.test(name) ? ("italic" as const) : ("normal" as const),
  };
}

function sampleTextBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.ceil(width)));
  const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.ceil(height)));
  try {
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Prefer light/background pixels and ignore dark glyph pixels.
      if (data[i] + data[i + 1] + data[i + 2] > 560) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }
    if (!count) return { r: 255, g: 255, b: 255 };
    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  } catch {
    return { r: 255, g: 255, b: 255 };
  }
}

function getExportFont(item: TextItem, fonts: Record<string, PDFFont>) {
  const family = item.fontFamily.toLowerCase();
  const bold = item.fontWeight >= 600;
  const italic = item.fontStyle === "italic";
  if (/times|serif|roman/.test(family)) {
    if (bold && italic) return fonts.timesBoldItalic;
    if (bold) return fonts.timesBold;
    if (italic) return fonts.timesItalic;
    return fonts.times;
  }
  if (/courier|mono|code/.test(family)) {
    if (bold && italic) return fonts.courierBoldItalic;
    if (bold) return fonts.courierBold;
    if (italic) return fonts.courierItalic;
    return fonts.courier;
  }
  if (bold && italic) return fonts.helveticaBoldItalic;
  if (bold) return fonts.helveticaBold;
  if (italic) return fonts.helveticaItalic;
  return fonts.helvetica;
}

function EditorPage() {
  const { fileId } = Route.useParams();
  const navigate = useNavigate();
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("document.pdf");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [showSig, setShowSig] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  const renderPdf = useCallback(async (buf: Uint8Array) => {
    const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
    const imgs: string[] = [];
    const sizes: { w: number; h: number }[] = [];
    const items: TextItem[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      imgs.push(canvas.toDataURL("image/png"));
      sizes.push({ w: viewport.width, h: viewport.height });

      const tc = (await page.getTextContent()) as {
        items: PdfTextContentItem[];
        styles: Record<string, PdfTextStyle>;
      };
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const style = tc.styles[it.fontName] || {};
        const tx = pdfjsLib.Util.transform(viewport.transform, it.transform);
        // tx[0..3] is the matrix, tx[4]/tx[5] is the position.
        // Font size is the vertical scale of the matrix.
        const fontSize = Math.hypot(tx[2], tx[3]);
        const width = (it.width || it.str.length * fontSize * 0.5) * viewport.scale;
        const ascent = typeof style.ascent === "number" ? style.ascent : 0.82;
        const descent = typeof style.descent === "number" ? style.descent : -0.18;
        // tx[5] is the baseline Y. Use PDF.js font metrics when available so
        // the edit box hugs the glyphs instead of creating a visible white band.
        const top = tx[5] - fontSize * ascent;
        const height = Math.max(fontSize * (ascent - descent), fontSize * 0.9);
        const fontInfo = inferFontInfo(`${it.fontName || ""} ${style.fontFamily || ""}`);
        items.push({
          id: `t-${i}-${items.length}`,
          page: i - 1,
          x: tx[4],
          y: top,
          width,
          height,
          fontSize,
          fontFamily: style.fontFamily || fontInfo.family,
          fontWeight: fontInfo.weight,
          fontStyle: fontInfo.style,
          background: sampleTextBackground(ctx, tx[4], top, width, height),
          originalStr: it.str,
          str: it.str,
        });
      }
    }

    setPageImages(imgs);
    setPageSizes(sizes);
    setTextItems(items);
    setPageRotations(new Array(imgs.length).fill(0));
  }, []);

  useEffect(() => {
    (async () => {
      const item = await getPdf(fileId);
      if (!item) {
        toast.error("File not found");
        navigate({ to: "/dashboard" });
        return;
      }
      setFileName(item.record.name);
      setPdfBytes(item.bytes);
      await renderPdf(item.bytes);
      setLoading(false);
    })();
  }, [fileId, navigate, renderPdf]);

  function commitTextEdit(id: string, newText: string) {
    setTextItems((items) => items.map((it) => (it.id === id ? { ...it, str: newText } : it)));
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (!overlayRef.current) return;
    if (tool === "select" || tool === "edit") return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "text") {
      const text = prompt("Enter text:");
      if (!text) return;
      setAnnotations((a) => [
        ...a,
        { id: crypto.randomUUID(), type: "text", page: currentPage, x, y, text, size: 16 },
      ]);
    } else if (tool === "highlight") {
      setAnnotations((a) => [
        ...a,
        {
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
    const embeddedFonts = {
      helvetica: font,
      helveticaBold: await doc.embedFont(StandardFonts.HelveticaBold),
      helveticaItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
      helveticaBoldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
      times: await doc.embedFont(StandardFonts.TimesRoman),
      timesBold: await doc.embedFont(StandardFonts.TimesRomanBold),
      timesItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
      timesBoldItalic: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
      courier: await doc.embedFont(StandardFonts.Courier),
      courierBold: await doc.embedFont(StandardFonts.CourierBold),
      courierItalic: await doc.embedFont(StandardFonts.CourierOblique),
      courierBoldItalic: await doc.embedFont(StandardFonts.CourierBoldOblique),
    };
    const pages = doc.getPages();

    pageRotations.forEach((rot, i) => {
      if (rot && pages[i]) {
        const current = pages[i].getRotation().angle;
        pages[i].setRotation(degrees((current + rot) % 360));
      }
    });

    // Apply text edits (only items whose str differs from originalStr)
    for (const it of textItems) {
      if (it.str === it.originalStr) continue;
      const page = pages[it.page];
      if (!page) continue;
      const rendered = pageSizes[it.page];
      if (!rendered) continue;
      const { width: pw, height: ph } = page.getSize();
      const sx = pw / rendered.w;
      const sy = ph / rendered.h;

      const editFont = getExportFont(it, embeddedFonts);
      const size = it.fontSize * sy;
      const editedWidth = editFont.widthOfTextAtSize(it.str, size);
      const coverWidth = Math.max(it.width * sx, editedWidth);
      // Cover only the original glyph area with the sampled page background.
      const pad = Math.max(0.35, size * 0.04);
      page.drawRectangle({
        x: it.x * sx - pad,
        y: ph - (it.y + it.height) * sy - pad,
        width: coverWidth + pad * 2,
        height: it.height * sy + pad * 2,
        color: rgb(it.background.r / 255, it.background.g / 255, it.background.b / 255),
      });
      page.drawText(it.str, {
        x: it.x * sx,
        y: ph - it.y * sy - size,
        size,
        font: editFont,
        color: rgb(0, 0, 0),
      });
    }

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
      await updatePdf(fileId, { bytes: out });
      setPdfBytes(out);
      await renderPdf(out);
      setAnnotations([]);
      toast.success("Saved");
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

  const currentSize = pageSizes[currentPage];
  const currentRotation = pageRotations[currentPage] || 0;
  const editing = tool === "edit";
  const pageTextItems = textItems.filter((t) => t.page === currentPage);
  const modifiedCount = textItems.filter((t) => t.str !== t.originalStr).length;

  return (
    <div className="min-h-screen bg-stone-100">
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

      {/* Top header */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <h1 className="truncate text-center text-base font-medium">
            {fileName}
            {modifiedCount > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {modifiedCount} edit{modifiedCount > 1 ? "s" : ""}
              </span>
            )}
          </h1>
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
      </div>

      {loading ? (
        <div className="grid h-96 place-items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Converting document for editing…
          </div>
        </div>
      ) : (
        <>
          {/* Sejda-style horizontal tools bar */}
          <div className="sticky top-0 z-20 border-b border-border bg-white shadow-sm">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-1 px-6 py-2">
              <TopTool
                icon={<MousePointer2 className="size-4" />}
                label="Select"
                active={tool === "select"}
                onClick={() => setTool("select")}
              />
              <TopTool
                icon={<Edit3 className="size-4" />}
                label="Edit text"
                active={tool === "edit"}
                onClick={() => setTool("edit")}
              />
              <TopTool
                icon={<Type className="size-4" />}
                label="Add text"
                active={tool === "text"}
                onClick={() => setTool("text")}
              />
              <TopTool
                icon={<Highlighter className="size-4" />}
                label="Highlight"
                active={tool === "highlight"}
                onClick={() => setTool("highlight")}
              />
              <TopTool
                icon={<PenTool className="size-4" />}
                label="Sign"
                active={tool === "sign"}
                onClick={() => setShowSig(true)}
              />
              <Divider />
              <TopTool
                icon={<RotateCw className="size-4" />}
                label="Rotate"
                onClick={rotateCurrent}
              />
              <TopTool
                icon={<Scissors className="size-4" />}
                label="Extract"
                onClick={handleSplitCurrent}
              />
              <TopTool
                icon={<Trash2 className="size-4" />}
                label="Delete page"
                onClick={deleteCurrent}
              />
              <Divider />
              <label>
                <div className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted">
                  <Plus className="size-4" />
                  <span>Merge</span>
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
              {(annotations.length > 0 || modifiedCount > 0) && (
                <>
                  <Divider />
                  <button
                    onClick={() => {
                      setAnnotations([]);
                      setTextItems((items) => items.map((it) => ({ ...it, str: it.originalStr })));
                    }}
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>

            {pageImages.length > 0 && (
              <div className="flex items-center justify-center gap-3 border-t border-border bg-stone-50 px-6 py-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-white disabled:opacity-40"
                >
                  ‹ Prev
                </button>
                <span className="font-mono text-xs text-muted-foreground">
                  Page {currentPage + 1} of {pageImages.length}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pageImages.length - 1, p + 1))}
                  disabled={currentPage >= pageImages.length - 1}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-white disabled:opacity-40"
                >
                  Next ›
                </button>
              </div>
            )}
          </div>

          {tool !== "select" && (
            <div className="mx-auto mt-3 max-w-[900px] rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-foreground">
              {editing &&
                "Click any text on the page and type to edit it in place. Click outside to save."}
              {tool === "text" && "Click anywhere on the page to add new text."}
              {tool === "highlight" && "Click to drop a yellow highlight."}
              {tool === "sign" && "Click on the page to place your signature."}
            </div>
          )}

          <div className="flex justify-center px-4 py-6">
            {pageImages[currentPage] && currentSize && (
              <div
                ref={overlayRef}
                onClick={handleCanvasClick}
                className="relative bg-white shadow-xl"
                style={{
                  width: currentSize.w,
                  height: currentSize.h,
                  cursor,
                  transform: currentRotation ? `rotate(${currentRotation}deg)` : undefined,
                }}
              >
                <img
                  src={pageImages[currentPage]}
                  alt=""
                  width={currentSize.w}
                  height={currentSize.h}
                  draggable={false}
                  style={{ display: "block", maxWidth: "none", userSelect: "none" }}
                />

                {pageTextItems.map((item) => (
                  <EditableTextRun
                    key={item.id}
                    item={item}
                    editing={editing}
                    active={activeTextId === item.id}
                    onActivate={() => setActiveTextId(item.id)}
                    onDeactivate={() => setActiveTextId((id) => (id === item.id ? null : id))}
                    onCommit={(v) => commitTextEdit(item.id, v)}
                  />
                ))}

                {annotations
                  .filter((a) => a.page === currentPage)
                  .map((a) => {
                    if (a.type === "text")
                      return (
                        <span
                          key={a.id}
                          className="absolute font-sans text-black"
                          style={{ left: a.x, top: a.y, fontSize: a.size, pointerEvents: "none" }}
                        >
                          {a.text}
                        </span>
                      );
                    if (a.type === "highlight")
                      return (
                        <div
                          key={a.id}
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
                    return (
                      <img
                        key={a.id}
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
        </>
      )}
    </div>
  );
}
function Divider() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

function TopTool({
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
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * A single editable text run rendered as an absolutely positioned contentEditable span.
 * Its initial textContent is set once on mount via a ref so React never overwrites
 * what the user types. On blur the new value is committed back to parent state.
 */
function EditableTextRun({
  item,
  editing,
  active,
  onActivate,
  onDeactivate,
  onCommit,
}: {
  item: TextItem;
  editing: boolean;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const lastSeenRef = useRef<string>(item.str);

  // Initialize / sync DOM text only when the source value changes from outside
  // (mount, reset, save round-trip) — never on every render.
  useEffect(() => {
    if (ref.current && ref.current.textContent !== item.str) {
      ref.current.textContent = item.str;
      lastSeenRef.current = item.str;
    }
  }, [item.str]);

  const isModified = item.str !== item.originalStr;

  return (
    <span
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={false}
      onClick={(e) => {
        if (editing) {
          e.stopPropagation();
          onActivate();
        }
      }}
      onFocus={onActivate}
      onBlur={(e) => {
        const v = e.currentTarget.textContent ?? "";
        if (v !== lastSeenRef.current) {
          lastSeenRef.current = v;
          onCommit(v);
        }
        onDeactivate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLSpanElement).blur();
        }
      }}
      style={{
        position: "absolute",
        left: item.x,
        top: item.y,
        minWidth: item.width,
        height: item.height,
        fontSize: item.fontSize,
        lineHeight: `${item.height}px`,
        fontFamily: item.fontFamily,
        fontWeight: item.fontWeight,
        fontStyle: item.fontStyle,
        color: "#000",
        background:
          active || isModified
            ? `rgb(${item.background.r}, ${item.background.g}, ${item.background.b})`
            : "transparent",
        outline: active ? "1px solid rgba(37,99,235,0.65)" : "none",
        padding: 0,
        margin: 0,
        whiteSpace: "pre",
        cursor: editing ? "text" : "default",
        pointerEvents: editing ? "auto" : "none",
        // When NOT editing and unmodified, keep the HTML span invisible so the
        // user sees the original rasterized text from the page image.
        opacity: active || isModified ? 1 : 0,
        userSelect: editing ? "text" : "none",
      }}
    />
  );
}

