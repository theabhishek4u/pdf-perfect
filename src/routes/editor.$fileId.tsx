import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFDict,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pdfjsLib } from "@/lib/pdfjs-setup";
import { SignaturePad } from "@/components/signature-pad";
import { setPreview } from "@/lib/preview-store";
import { toast } from "sonner";
import {
  ArrowLeft,
  Type,
  Highlighter,
  PenTool,
  Download,
  Save,
  Eye,
  Scissors,
  Plus,
  RotateCw,
  Trash2,
  Loader2,
  Edit3,
  MousePointer2,
  Undo2,
  Redo2,
  Search,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { getPdf, updatePdf } from "@/lib/pdf-store";

type HistorySnap = {
  textItems: TextItem[];
  annotations: Annotation[];
  pageRotations: number[];
};

export const Route = createFileRoute("/editor/$fileId")({
  ssr: false,
  component: EditorPage,
  head: () => ({ meta: [{ title: "Editor — PDF Editify" }] }),
});

type Tool = "select" | "edit" | "text" | "highlight" | "sign";

// A single text run extracted from the PDF page. Coordinates are in CSS pixels
// of the rendered page (1:1 with the displayed image).
type RGB = { r: number; g: number; b: number };
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
  psFontName: string | null;
  background: RGB;
  color: RGB;
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

const RENDER_SCALE = Math.min(
  3,
  Math.max(1.75, (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1) * 1.5),
);

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

// Detect background + foreground color of a text run by sampling its bounding
// box. Strategy: bucket pixels into a coarse color histogram, take the most
// frequent bucket as the background, then average the pixels that lie farthest
// from that background — those are the strokes of the glyphs. This works for
// any text color (black, blue, red, white-on-dark, etc.).
function sampleTextBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): { background: RGB; color: RGB } {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.ceil(width)));
  const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.ceil(height)));
  try {
    const data = ctx.getImageData(sx, sy, sw, sh).data;
    const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // 5-bit-per-channel bucketing → 32^3 buckets
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const cur = buckets.get(key);
      if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n++; }
      else buckets.set(key, { r, g, b, n: 1 });
    }
    // Background = most common bucket.
    let bg = { r: 255, g: 255, b: 255, n: 0 };
    for (const v of buckets.values()) if (v.n > bg.n) bg = v;
    const background: RGB = {
      r: Math.round(bg.r / bg.n),
      g: Math.round(bg.g / bg.n),
      b: Math.round(bg.b / bg.n),
    };
    // Foreground = average of pixels farthest from background (top ~12%).
    const dists: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - background.r;
      const dg = data[i + 1] - background.g;
      const db = data[i + 2] - background.b;
      dists.push(dr * dr + dg * dg + db * db);
    }
    const sorted = [...dists].sort((a, b) => b - a);
    const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.12))];
    const minThreshold = 40 * 40; // ignore anti-aliasing noise
    let fr = 0, fg = 0, fb = 0, fn = 0;
    for (let p = 0, i = 0; i < data.length; i += 4, p++) {
      if (dists[p] >= Math.max(threshold, minThreshold)) {
        fr += data[i]; fg += data[i + 1]; fb += data[i + 2]; fn++;
      }
    }
    const color: RGB = fn
      ? { r: Math.round(fr / fn), g: Math.round(fg / fn), b: Math.round(fb / fn) }
      // Fallback: pick the channel-wise opposite of the background.
      : {
          r: background.r > 128 ? 0 : 255,
          g: background.g > 128 ? 0 : 255,
          b: background.b > 128 ? 0 : 255,
        };
    return { background, color };
  } catch {
    return { background: { r: 255, g: 255, b: 255 }, color: { r: 0, g: 0, b: 0 } };
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
  const [tool, setTool] = useState<Tool>("edit");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [showSig, setShowSig] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchIdx, setSearchIdx] = useState(0);
  const [past, setPast] = useState<HistorySnap[]>([]);
  const [future, setFuture] = useState<HistorySnap[]>([]);
  const [autoSaveAt, setAutoSaveAt] = useState<number | null>(null);
  const [draggingPage, setDraggingPage] = useState<number | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HistorySnap>({ textItems: [], annotations: [], pageRotations: [] });
  useEffect(() => {
    stateRef.current = { textItems, annotations, pageRotations };
  }, [textItems, annotations, pageRotations]);

  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-49), stateRef.current]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [stateRef.current, ...f].slice(0, 50));
      setTextItems(prev.textItems);
      setAnnotations(prev.annotations);
      setPageRotations(prev.pageRotations);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setPast((p) => [...p, stateRef.current].slice(-50));
      setTextItems(next.textItems);
      setAnnotations(next.annotations);
      setPageRotations(next.pageRotations);
      return f.slice(1);
    });
  }, []);


  const renderPdf = useCallback(async (buf: Uint8Array) => {
    const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
    const imgs: string[] = [];
    const sizes: { w: number; h: number }[] = [];
    const items: TextItem[] = [];

    setPageImages([]);
    setPageSizes([]);
    setTextItems([]);

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d", { alpha: false })!;
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
        const fontSize = Math.hypot(tx[2], tx[3]);
        const width = (it.width || it.str.length * fontSize * 0.5) * viewport.scale;
        const ascent = typeof style.ascent === "number" ? style.ascent : 0.82;
        const descent = typeof style.descent === "number" ? style.descent : -0.18;
        const top = tx[5] - fontSize * ascent;
        const height = Math.max(fontSize * (ascent - descent), fontSize * 0.9);

        // Try to read the embedded PostScript font name from pdfjs's loaded
        // font objects. This is what we'll match against pdf-lib's embedded
        // fonts so edits keep the exact original typeface.
        let psFontName: string | null = null;
        try {
          const fontObj = (page as unknown as {
            commonObjs: { get: (n: string) => { name?: string } | null };
          }).commonObjs.get(it.fontName);
          if (fontObj?.name) {
            psFontName = fontObj.name.replace(/^[A-Z]{6}\+/, "");
          }
        } catch {
          /* font not ready — fall back to family heuristic */
        }
        const fontInfo = inferFontInfo(
          `${psFontName || ""} ${it.fontName || ""} ${style.fontFamily || ""}`,
        );
        const sampled = sampleTextBackground(ctx, tx[4], top, width, height);
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
          psFontName,
          background: sampled.background,
          color: sampled.color,
          originalStr: it.str,
          str: it.str,
        });
      }

      // Push progressive state so the user can start editing the first page
      // immediately while remaining pages are still rendering.
      setPageImages([...imgs]);
      setPageSizes([...sizes]);
      setTextItems([...items]);
    }

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
      // Flip loading off as soon as the first page renders so the editor
      // becomes interactive immediately.
      const first = renderPdf(item.bytes);
      const off = setTimeout(() => setLoading(false), 50);
      await first;
      clearTimeout(off);
      setLoading(false);
    })();
  }, [fileId, navigate, renderPdf]);

  function commitTextEdit(id: string, newText: string) {
    pushHistory();
    setTextItems((items) => items.map((it) => (it.id === id ? { ...it, str: newText } : it)));
  }

  function updateTextStyle(id: string, patch: Partial<TextItem>) {
    pushHistory();
    setTextItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function resetTextItem(id: string) {
    pushHistory();
    setTextItems((items) =>
      items.map((it) => (it.id === id ? { ...it, str: it.originalStr } : it)),
    );
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
      pushHistory();
      setAnnotations((a) => [
        ...a,
        { id: crypto.randomUUID(), type: "text", page: currentPage, x, y, text, size: 16 },
      ]);
    } else if (tool === "highlight") {
      pushHistory();
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
      pushHistory();
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


  async function extractOriginalFonts(doc: PDFDocument): Promise<Map<string, PDFFont>> {
    const map = new Map<string, PDFFont>();
    try {
      doc.registerFontkit(fontkit);
      const ctx = doc.context;
      const indirect = ctx.enumerateIndirectObjects();
      for (const [, obj] of indirect) {
        if (!(obj instanceof PDFDict)) continue;
        const type = obj.get(PDFName.of("Type"));
        if (!type || type.toString() !== "/Font") continue;
        const descriptor = obj.lookup(PDFName.of("FontDescriptor"));
        if (!(descriptor instanceof PDFDict)) continue;
        const fontFileRef =
          descriptor.lookup(PDFName.of("FontFile2")) ||
          descriptor.lookup(PDFName.of("FontFile3")) ||
          descriptor.lookup(PDFName.of("FontFile"));
        if (!(fontFileRef instanceof PDFRawStream)) continue;
        const psNameRaw = descriptor.get(PDFName.of("FontName"))?.toString() || "";
        const psName = psNameRaw.replace(/^\//, "").replace(/^[A-Z]{6}\+/, "");
        if (!psName || map.has(psName.toLowerCase())) continue;
        try {
          const bytes = decodePDFRawStream(fontFileRef).decode();
          // subset:false so the re-embedded font has the full glyph set —
          // edits can use characters that weren't in the original subset
          // without falling back to Helvetica.
          const embedded = await doc.embedFont(bytes, { subset: false });
          map.set(psName.toLowerCase(), embedded);
        } catch {
          /* skip unsupported font formats (Type1, CFF without OpenType wrapper, etc.) */
        }
      }
    } catch {
      /* ignore — fall back to standard fonts */
    }
    return map;
  }

  async function buildEditedPdf(): Promise<Uint8Array> {
    if (!pdfBytes) throw new Error("No PDF");
    const doc = await PDFDocument.load(pdfBytes);
    doc.registerFontkit(fontkit);
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
    const originalFonts = await extractOriginalFonts(doc);
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

      // Prefer the exact original embedded font when available so edits are
      // visually indistinguishable from the surrounding text.
      const originalFont = it.psFontName
        ? originalFonts.get(it.psFontName.toLowerCase())
        : undefined;
      const editFont = originalFont ?? getExportFont(it, embeddedFonts);
      const size = it.fontSize * sy;
      let editedWidth = size * it.str.length * 0.5;
      try {
        editedWidth = editFont.widthOfTextAtSize(it.str, size);
      } catch {
        /* some embedded subsets can't measure arbitrary chars — keep estimate */
      }
      const coverWidth = Math.max(it.width * sx, editedWidth);
      const pad = Math.max(0.35, size * 0.04);
      const editLeft = it.x * sx - pad;
      const editRight = editLeft + coverWidth + pad * 2;

      // Cover same-line neighboring runs that fall within the new horizontal
      // span. PDFs often split a single visual word (e.g. a heading) into
      // multiple TextItems; if the user edits only one, the others would
      // remain visible as ghost fragments behind/around the new text.
      for (const other of textItems) {
        if (other === it) continue;
        if (other.page !== it.page) continue;
        // Only auto-cover unedited neighbors — don't clobber other user edits.
        if (other.str !== other.originalStr) continue;
        // Same baseline (within ~half the line height).
        if (Math.abs(other.y - it.y) > Math.max(it.height, other.height) * 0.5) continue;
        const oLeft = other.x * sx;
        const oRight = (other.x + other.width) * sx;
        if (oRight < editLeft || oLeft > editRight) continue;
        const oPad = Math.max(0.35, other.fontSize * sy * 0.04);
        page.drawRectangle({
          x: oLeft - oPad,
          y: ph - (other.y + other.height) * sy - oPad,
          width: other.width * sx + oPad * 2,
          height: other.height * sy + oPad * 2,
          color: rgb(other.background.r / 255, other.background.g / 255, other.background.b / 255),
        });
      }

      page.drawRectangle({
        x: editLeft,
        y: ph - (it.y + it.height) * sy - pad,
        width: coverWidth + pad * 2,
        height: it.height * sy + pad * 2,
        color: rgb(it.background.r / 255, it.background.g / 255, it.background.b / 255),
      });
      try {
        page.drawText(it.str, {
          x: it.x * sx,
          y: ph - it.y * sy - size,
          size,
          font: editFont,
          color: rgb(it.color.r / 255, it.color.g / 255, it.color.b / 255),
        });
      } catch {
        // Original font can't encode the new characters — fall back to standard.
        page.drawText(it.str, {
          x: it.x * sx,
          y: ph - it.y * sy - size,
          size,
          font: getExportFont(it, embeddedFonts),
          color: rgb(it.color.r / 255, it.color.g / 255, it.color.b / 255),
        });
      }
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

  async function handleApplyPreview() {
    setSaving(true);
    try {
      const out = await buildEditedPdf();
      setPreview(fileId, out, fileName);
      navigate({ to: "/preview/$fileId", params: { fileId } });
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
    pushHistory();
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
    pushHistory();
    const src = await PDFDocument.load(pdfBytes);
    src.removePage(currentPage);
    const bytes = await src.save();
    setPdfBytes(bytes);
    await renderPdf(bytes);
    setAnnotations((a) => a.filter((x) => x.page !== currentPage));
    setCurrentPage((p) => Math.max(0, p - 1));
  }

  async function duplicatePage(idx: number) {
    if (!pdfBytes) return;
    setSaving(true);
    try {
      pushHistory();
      const src = await PDFDocument.load(pdfBytes);
      const [copy] = await src.copyPages(src, [idx]);
      src.insertPage(idx + 1, copy);
      const bytes = await src.save();
      setPdfBytes(bytes);
      await renderPdf(bytes);
      toast.success(`Page ${idx + 1} duplicated`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function reorderPages(from: number, to: number) {
    if (!pdfBytes || from === to) return;
    setSaving(true);
    try {
      pushHistory();
      const src = await PDFDocument.load(pdfBytes);
      const order = Array.from({ length: src.getPageCount() }, (_, i) => i);
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, order);
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      setPdfBytes(bytes);
      await renderPdf(bytes);
      setCurrentPage(to);
      toast.success("Page moved");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  // Keyboard shortcuts: Undo/Redo/Save/Search/Page nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      // Don't hijack Ctrl+Z/Y/F while user is typing inside a text field —
      // let the browser's native behavior take over (native typing undo, etc).
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (inEditable) return;
        e.preventDefault();
        undo();
      } else if (
        mod &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (inEditable) return;
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (!inEditable && e.key === "Escape") {
        setSearchOpen(false);
      } else if (!inEditable && (e.key === "ArrowLeft" || e.key === "PageUp")) {
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (!inEditable && (e.key === "ArrowRight" || e.key === "PageDown")) {
        setCurrentPage((p) => Math.min(pageImages.length - 1, p + 1));
      }

    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, pageImages.length]);

  // Auto-save edit state to localStorage for crash recovery. Debounced + de-duped
  // so it doesn't fire while the user is just clicking / mousing around.
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          textItems: textItems
            .filter((t) => t.str !== t.originalStr)
            .map((t) => ({
              id: t.id,
              str: t.str,
              color: t.color,
              fontSize: t.fontSize,
              fontWeight: t.fontWeight,
              fontStyle: t.fontStyle,
            })),
          annotations,
          pageRotations,
        });
        if (payload === lastSavedRef.current) return;
        lastSavedRef.current = payload;
        localStorage.setItem(`pdf-editify-edits-${fileId}`, payload);
        setAutoSaveAt(Date.now());
      } catch {
        /* quota or serialization issue — skip */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [textItems, annotations, pageRotations, loading, fileId]);


  // Search matches
  const searchMatches = searchQ.trim()
    ? textItems
        .map((it, i) => ({ it, i }))
        .filter(({ it }) => it.str.toLowerCase().includes(searchQ.toLowerCase()))
    : [];
  useEffect(() => {
    if (!searchMatches.length) return;
    const m = searchMatches[Math.min(searchIdx, searchMatches.length - 1)];
    if (m && m.it.page !== currentPage) setCurrentPage(m.it.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchIdx, searchQ]);

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
  const activeItem = textItems.find((t) => t.id === activeTextId) || null;
  const modifiedCount = textItems.filter((t) => t.str !== t.originalStr).length;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;


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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-2 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              title={sidebarOpen ? "Hide pages" : "Show pages"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </button>
          </div>
          <h1 className="flex min-w-0 items-center justify-center gap-2 truncate text-center text-base font-medium">
            <span className="truncate">{fileName}</span>
            {modifiedCount > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {modifiedCount} edit{modifiedCount > 1 ? "s" : ""}
              </span>
            )}
            {autoSaveAt && (
              <span
                className="hidden items-center gap-1 text-xs text-emerald-600 sm:flex"
                title={`Auto-saved ${new Date(autoSaveAt).toLocaleTimeString()}`}
              >
                <CheckCircle2 className="size-3" /> Auto-saved
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              title="Save (Ctrl+S)"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
            <button
              onClick={handleApplyPreview}
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              Apply &amp; Preview
            </button>
            <button
              onClick={handleDownload}
              disabled={saving}
              className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-1 px-6 py-2">
              <TopTool
                icon={<Undo2 className="size-4" />}
                label="Undo"
                onClick={undo}
                disabled={!canUndo}
              />
              <TopTool
                icon={<Redo2 className="size-4" />}
                label="Redo"
                onClick={redo}
                disabled={!canRedo}
              />
              <Divider />
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
                icon={<Search className="size-4" />}
                label="Find"
                active={searchOpen}
                onClick={() => setSearchOpen((v) => !v)}
              />
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
                icon={<Copy className="size-4" />}
                label="Duplicate"
                onClick={() => duplicatePage(currentPage)}
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
                      pushHistory();
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

            {searchOpen && (
              <div className="flex items-center justify-center gap-2 border-t border-border bg-stone-50 px-6 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchIdx(0);
                  }}
                  placeholder="Find in document…"
                  className="h-8 w-72 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {searchMatches.length
                    ? `${Math.min(searchIdx + 1, searchMatches.length)} / ${searchMatches.length}`
                    : searchQ
                      ? "0 / 0"
                      : ""}
                </span>
                <button
                  onClick={() => setSearchIdx((i) => Math.max(0, i - 1))}
                  disabled={!searchMatches.length}
                  className="grid size-7 place-items-center rounded hover:bg-white disabled:opacity-40"
                  title="Previous"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  onClick={() =>
                    setSearchIdx((i) => Math.min(searchMatches.length - 1, i + 1))
                  }
                  disabled={!searchMatches.length}
                  className="grid size-7 place-items-center rounded hover:bg-white disabled:opacity-40"
                  title="Next"
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQ("");
                  }}
                  className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-white"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

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


          <div className="flex">
            {/* Thumbnail sidebar */}
            {sidebarOpen && (
              <aside className="sticky top-[112px] hidden h-[calc(100vh-112px)] w-48 shrink-0 overflow-y-auto border-r border-border bg-white/70 px-2 py-3 backdrop-blur md:block">
                <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pages · drag to reorder
                </div>
                <div className="flex flex-col gap-2">
                  {pageImages.map((src, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => setDraggingPage(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingPage !== null && draggingPage !== idx) {
                          reorderPages(draggingPage, idx);
                        }
                        setDraggingPage(null);
                      }}
                      onDragEnd={() => setDraggingPage(null)}
                      onClick={() => setCurrentPage(idx)}
                      className={`group relative cursor-pointer rounded-md border-2 p-1 transition-all ${
                        currentPage === idx
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border hover:bg-white"
                      } ${draggingPage === idx ? "opacity-40" : ""}`}
                    >
                      <img
                        src={src}
                        alt={`Page ${idx + 1}`}
                        className="w-full rounded-sm bg-white shadow-sm"
                        draggable={false}
                      />
                      <div className="mt-1 flex items-center justify-between px-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicatePage(idx);
                            }}
                            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Duplicate"
                          >
                            <Copy className="size-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentPage(idx);
                              setTimeout(deleteCurrent, 0);
                            }}
                            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            )}

            <div className="flex flex-1 justify-center px-4 py-6">
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

                  {pageTextItems.map((item) => {
                    const isMatch =
                      searchQ.trim() &&
                      item.str.toLowerCase().includes(searchQ.toLowerCase());
                    return (
                      <EditableTextRun
                        key={item.id}
                        item={item}
                        editing={editing}
                        active={activeTextId === item.id}
                        highlight={!!isMatch}
                        onActivate={() => setActiveTextId(item.id)}
                        onDeactivate={() =>
                          setActiveTextId((id) => (id === item.id ? null : id))
                        }
                        onCommit={(v) => commitTextEdit(item.id, v)}
                        onCancel={() => {
                          resetTextItem(item.id);
                          setActiveTextId(null);
                        }}
                      />
                    );
                  })}

                  {editing && activeItem && activeItem.page === currentPage && (
                    <FloatingTextToolbar
                      item={activeItem}
                      containerWidth={currentSize.w}
                      onChange={(patch) => updateTextStyle(activeItem.id, patch)}
                      onReset={() => resetTextItem(activeItem.id)}
                    />
                  )}

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
          </div>

          <div className="sticky bottom-0 z-10 border-t border-border bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-3 px-6 py-3">
              <button
                onClick={handleApplyPreview}
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md hover:bg-accent disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                Apply &amp; Preview
              </button>
              <span className="text-xs text-muted-foreground">
                Review the final output, then download.
              </span>
            </div>
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
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
 */
const EditableTextRun = React.memo(
  function EditableTextRun({
    item,
    editing,
    active,
    highlight,
    onActivate,
    onDeactivate,
    onCommit,
    onCancel,
  }: {
    item: TextItem;
    editing: boolean;
    active: boolean;
    highlight?: boolean;
    onActivate: () => void;
    onDeactivate: () => void;
    onCommit: (v: string) => void;
    onCancel: () => void;
  }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const lastSeenRef = useRef<string>(item.str);
    const pendingClickRef = useRef<{ x: number; y: number } | null>(null);
    const [hover, setHover] = useState(false);

    // Keep DOM text in sync with state (only when state changes — never while user is typing).
    useEffect(() => {
      if (ref.current && ref.current.textContent !== item.str) {
        ref.current.textContent = item.str;
        lastSeenRef.current = item.str;
      }
    }, [item.str]);

    // When the run becomes active, focus the element and place the caret at the
    // click position. Doing this in an effect (rather than rAF inside mousedown)
    // guarantees the element is contentEditable=true before we focus it.
    useEffect(() => {
      if (!active || !ref.current) return;
      const el = ref.current;
      el.focus({ preventScroll: true });
      const click = pendingClickRef.current;
      pendingClickRef.current = null;
      placeCaret(el, click);
    }, [active]);

    const isModified = item.str !== item.originalStr;
    const visible = active || isModified || highlight;

    return (
      <span
        ref={ref}
        contentEditable={editing && active}
        suppressContentEditableWarning
        spellCheck={false}
        onMouseEnter={() => editing && setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseDown={(e) => {
          if (!editing) return;
          e.stopPropagation();
          // Remember the click point so the caret-placement effect can use it
          // once active=true triggers a rerender with contentEditable enabled.
          pendingClickRef.current = { x: e.clientX, y: e.clientY };
          if (!active) {
            e.preventDefault();
            onActivate();
          }
        }}
        onBlur={(e) => {
          const v = e.currentTarget.textContent ?? "";
          if (v !== lastSeenRef.current) {
            lastSeenRef.current = v;
            onCommit(v);
          }
          onDeactivate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.currentTarget as HTMLSpanElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
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
          color: `rgb(${item.color.r}, ${item.color.g}, ${item.color.b})`,
          background: highlight
            ? "rgba(250, 204, 21, 0.55)"
            : visible
              ? `rgb(${item.background.r}, ${item.background.g}, ${item.background.b})`
              : "transparent",
          outline: active
            ? "1px solid rgba(37,99,235,0.75)"
            : highlight
              ? "1px solid rgba(234,179,8,0.9)"
              : hover && editing
                ? "1px dashed rgba(37,99,235,0.45)"
                : "none",
          padding: 0,
          margin: 0,
          whiteSpace: "pre",
          cursor: editing ? "text" : "default",
          pointerEvents: editing ? "auto" : "none",
          opacity: visible ? 1 : hover && editing ? 0.001 : 0,
          userSelect: editing ? "text" : "none",
        }}
      />
    );
  },
  // Only re-render when the props that actually affect rendering change.
  // Callback identity is ignored — parents always pass fresh inline closures.
  (a, b) =>
    a.item === b.item &&
    a.editing === b.editing &&
    a.active === b.active &&
    a.highlight === b.highlight,
);

function placeCaret(el: HTMLElement, click: { x: number; y: number } | null) {
  type CaretFnDoc = Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const doc = document as CaretFnDoc;
  let range: Range | null = null;
  if (click) {
    if (typeof doc.caretRangeFromPoint === "function") {
      range = doc.caretRangeFromPoint(click.x, click.y);
    } else if (typeof doc.caretPositionFromPoint === "function") {
      const pos = doc.caretPositionFromPoint(click.x, click.y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}


function FloatingTextToolbar({
  item,
  containerWidth,
  onChange,
  onReset,
}: {
  item: TextItem;
  containerWidth: number;
  onChange: (patch: Partial<TextItem>) => void;
  onReset: () => void;
}) {
  const TOOLBAR_W = 320;
  const left = Math.max(8, Math.min(containerWidth - TOOLBAR_W - 8, item.x));
  const top = Math.max(8, item.y - 44);
  const colorHex = `#${[item.color.r, item.color.g, item.color.b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="absolute z-30 flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 shadow-lg"
      style={{ left, top, width: TOOLBAR_W }}
    >
      <button
        onClick={() => onChange({ fontWeight: item.fontWeight >= 600 ? 400 : 700 })}
        className={`grid size-7 place-items-center rounded text-sm font-bold ${
          item.fontWeight >= 600 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
        title="Bold"
      >
        B
      </button>
      <button
        onClick={() =>
          onChange({ fontStyle: item.fontStyle === "italic" ? "normal" : "italic" })
        }
        className={`grid size-7 place-items-center rounded text-sm italic ${
          item.fontStyle === "italic" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
        title="Italic"
      >
        I
      </button>
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        onClick={() => onChange({ fontSize: Math.max(4, item.fontSize - 1) })}
        className="grid size-7 place-items-center rounded text-sm hover:bg-muted"
        title="Decrease size"
      >
        −
      </button>
      <input
        type="number"
        value={Math.round(item.fontSize)}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v > 0) onChange({ fontSize: v });
        }}
        className="h-7 w-12 rounded border border-border bg-background px-1 text-center text-xs"
      />
      <button
        onClick={() => onChange({ fontSize: item.fontSize + 1 })}
        className="grid size-7 place-items-center rounded text-sm hover:bg-muted"
        title="Increase size"
      >
        +
      </button>
      <div className="mx-1 h-5 w-px bg-border" />
      <label
        className="grid size-7 cursor-pointer place-items-center rounded hover:bg-muted"
        title="Text color"
      >
        <span
          className="block size-4 rounded border border-border"
          style={{ background: colorHex }}
        />
        <input
          type="color"
          value={colorHex}
          onChange={(e) => {
            const hex = e.target.value;
            onChange({
              color: {
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
              },
            });
          }}
          className="hidden"
        />
      </label>
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        onClick={onReset}
        className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        title="Reset to original (Esc)"
      >
        Reset
      </button>
    </div>
  );
}
